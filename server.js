/**
 * Wholesale HQ — AI Chatbot Server
 *
 * HOW IT WORKS:
 *   Zap #1 (Inbound):  SmarterContact "New Reply" → Webhooks by Zapier → POST /webhook/smartercontact
 *   Zap #2 (Outbound): Webhooks by Zapier (catch hook) → SmarterContact "Send Message"
 *
 * Our server sits in the middle: receives the inbound Zapier POST, generates an
 * AI reply with Claude, then POSTs the reply to the Zap #2 catch-hook URL so
 * Zapier can fire it back through SmarterContact.
 *
 * Required env vars (copy .env.example → .env):
 *   ANTHROPIC_API_KEY           — from console.anthropic.com
 *   ZAPIER_OUTBOUND_WEBHOOK_URL — Zap #2 catch-hook URL (Zapier gives you this)
 *   PORT                        — default 3001
 */

import express from "express";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;
const DATA_FILE = join(__dirname, "conversations.json");

// ---------------------------------------------------------------------------
// Conversation persistence (JSON file — swap for a DB in production)
// ---------------------------------------------------------------------------
function loadConversations() {
  if (!existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveConversations(data) {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let conversations = loadConversations();

// ---------------------------------------------------------------------------
// Anthropic / Claude
// ---------------------------------------------------------------------------
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Alex, a friendly SMS assistant for Fort Rose Capital — a real estate investment company in North Carolina run by Connor Orcutt. You are texting homeowners who may be interested in a cash offer on their property.

Your goals (in order):
1. Have a natural, low-pressure conversation to understand their situation.
2. Find out if they are open to selling and on what timeline.
3. If they show any interest, ask to set up a free 15-minute call with Connor.
4. Connor is available Mon–Fri, 9 am–6 pm Eastern for calls (virtual or in-person meetings also available).
5. Once an appointment is confirmed, wrap up warmly and stop pushing.

Critical SMS rules:
- Every message must be 1–3 SHORT sentences. This is SMS — brevity is essential.
- Never be pushy, salesy, or repeat the same pitch twice.
- Be empathetic — many sellers have stressful situations (divorce, foreclosure, inherited property, etc.).
- If they say "stop", "unsubscribe", "remove me", or "not interested", respond once to politely acknowledge and do not follow up again.
- Do NOT mention a specific property address unless the contact brings it up first.

Special markers — append to the END of your reply when appropriate (stripped before sending):
- When an appointment time is confirmed: [APPOINTMENT_SCHEDULED: <day and time the contact agreed to>]
- When the contact opts out or is firmly not interested: [OPT_OUT]`;

async function generateReply(history) {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: SYSTEM_PROMPT,
    messages: history,
  });
  return response.content.find((b) => b.type === "text")?.text ?? "";
}

// ---------------------------------------------------------------------------
// Zapier outbound webhook
//
// Zap #2 setup in Zapier:
//   Trigger:  Webhooks by Zapier → Catch Hook  (copy the URL → ZAPIER_OUTBOUND_WEBHOOK_URL)
//   Action:   SmarterContact → Send Message
//     • Map "contact_id"    → contact_id field from the webhook payload
//     • Map "message"       → message field from the webhook payload
// ---------------------------------------------------------------------------
async function sendViaZapier(contactId, contactPhone, message) {
  const url = process.env.ZAPIER_OUTBOUND_WEBHOOK_URL;
  if (!url) throw new Error("ZAPIER_OUTBOUND_WEBHOOK_URL is not set in .env");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contact_id: contactId,
      contact_phone: contactPhone,
      message,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Zapier outbound webhook failed (${res.status}): ${body}`);
  }
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

// CORS — allow the Vite dev server on port 5173 to hit the API
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---------------------------------------------------------------------------
// POST /webhook/smartercontact
//
// Zap #1 setup in Zapier:
//   Trigger: SmarterContact → New Reply (fires when a contact replies to your campaign)
//   Action:  Webhooks by Zapier → POST
//     • URL:         http://your-server:3001/webhook/smartercontact
//     • Payload:     JSON  (Zapier passes SmarterContact fields through automatically)
//
// Zapier will POST a JSON body that includes SmarterContact contact fields.
// Common field names from SmarterContact via Zapier:
//   contact_id, id, contact_phone, phone, contact_name, name, message, body, text
// We try all known variants so it works regardless of how Zapier maps the fields.
// ---------------------------------------------------------------------------
app.post("/webhook/smartercontact", async (req, res) => {
  // Acknowledge immediately so Zapier doesn't retry
  res.json({ received: true });

  const body = req.body;
  console.log("[webhook] received:", JSON.stringify(body));

  // Normalise field names — Zapier may use different keys depending on version
  const contactId   = body.contact_id   || body.id            || body.contactId   || "";
  const contactPhone= body.contact_phone|| body.phone         || body.contactPhone || body.phoneNumber || "";
  const contactName = body.contact_name || body.name          || body.contactName  || "Unknown";
  const message     = body.message      || body.body          || body.text         || body.content    || "";
  const direction   = body.direction    || body.type          || "inbound";

  // Only process inbound (replies from contacts)
  if (direction && !["inbound", "incoming", "received"].includes(direction.toLowerCase())) return;

  const id = String(contactId || contactPhone).trim();
  if (!id || !message.trim()) {
    console.log("[webhook] skipped — missing id or message");
    return;
  }

  // Init or retrieve conversation record
  if (!conversations[id]) {
    conversations[id] = {
      id,
      contactPhone: contactPhone || id,
      contactName,
      status: "active", // active | paused | scheduled | opted-out
      history: [],
      appointmentTime: null,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
  }

  const convo = conversations[id];

  // Don't auto-reply if paused or opted-out
  if (convo.status === "paused" || convo.status === "opted-out") {
    console.log(`[webhook] skipping ${id} — status: ${convo.status}`);
    saveConversations(conversations);
    return;
  }

  // Append inbound message to history
  convo.history.push({ role: "user", content: message.trim() });
  convo.lastActivity = new Date().toISOString();

  try {
    const rawReply = await generateReply(convo.history);
    console.log(`[claude] raw reply for ${id}:`, rawReply);

    // Parse control markers
    let cleanReply = rawReply;
    let newStatus = convo.status;
    let appointmentTime = convo.appointmentTime;

    const apptMatch = rawReply.match(/\[APPOINTMENT_SCHEDULED:\s*([^\]]+)\]/);
    if (apptMatch) {
      cleanReply = cleanReply.replace(apptMatch[0], "").trim();
      newStatus = "scheduled";
      appointmentTime = apptMatch[1].trim();
    }

    if (rawReply.includes("[OPT_OUT]")) {
      cleanReply = cleanReply.replace("[OPT_OUT]", "").trim();
      newStatus = "opted-out";
    }

    // Save outbound reply to history
    convo.history.push({ role: "assistant", content: cleanReply });
    convo.status = newStatus;
    convo.appointmentTime = appointmentTime;
    convo.lastActivity = new Date().toISOString();
    saveConversations(conversations);

    // Fire reply back through Zapier → SmarterContact
    await sendViaZapier(id, convo.contactPhone, cleanReply);
    console.log(`[zapier] reply sent for ${id}`);
  } catch (err) {
    console.error("[webhook] error:", err.message);
    convo.history.push({ role: "assistant", content: "[ERROR — reply not sent]" });
    saveConversations(conversations);
  }
});

// ---------------------------------------------------------------------------
// REST API — consumed by the frontend dashboard
// ---------------------------------------------------------------------------

app.get("/api/conversations", (req, res) => {
  const list = Object.values(conversations).sort(
    (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
  );
  res.json(list);
});

app.get("/api/conversations/:id", (req, res) => {
  const convo = conversations[req.params.id];
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json(convo);
});

app.post("/api/conversations/:id/pause", (req, res) => {
  const convo = conversations[req.params.id];
  if (!convo) return res.status(404).json({ error: "Not found" });
  convo.status = "paused";
  saveConversations(conversations);
  res.json(convo);
});

app.post("/api/conversations/:id/resume", (req, res) => {
  const convo = conversations[req.params.id];
  if (!convo) return res.status(404).json({ error: "Not found" });
  convo.status = "active";
  saveConversations(conversations);
  res.json(convo);
});

app.get("/api/stats", (req, res) => {
  const all = Object.values(conversations);
  res.json({
    total: all.length,
    active: all.filter((c) => c.status === "active").length,
    scheduled: all.filter((c) => c.status === "scheduled").length,
    optedOut: all.filter((c) => c.status === "opted-out").length,
    paused: all.filter((c) => c.status === "paused").length,
  });
});

// Simple health check so you can confirm the server is reachable
app.get("/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`\nWholesale HQ AI server → http://localhost:${PORT}`);
  console.log(`Health check            → GET  http://localhost:${PORT}/health`);
  console.log(`Webhook (Zap #1)        → POST http://localhost:${PORT}/webhook/smartercontact\n`);
});
