/**
 * Wholesale HQ — AI Chatbot Server
 *
 * Receives inbound SMS webhooks from SmarterContact, runs the conversation
 * through Claude, and sends the AI reply back via the SmarterContact API.
 *
 * Required env vars (copy .env.example → .env):
 *   ANTHROPIC_API_KEY
 *   SMARTER_CONTACT_API_KEY
 *   SMARTER_CONTACT_FROM_NUMBER   (your SmarterContact sending number)
 *   WEBHOOK_SECRET                (optional — verify SC webhook signature)
 *   PORT                          (default 3001)
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
// Anthropic client
// ---------------------------------------------------------------------------
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are Alex, a friendly SMS assistant for Fort Rose Capital — a real estate investment company in North Carolina run by Connor Orcutt. You are texting homeowners about a potential cash offer on their property.

Your goals (in order):
1. Start a natural, low-pressure conversation to understand their situation.
2. Find out if they are open to selling and on what timeline.
3. If they show any interest, ask to set up a free 15-minute call with Connor.
4. Connor is available Mon–Fri, 9 am–6 pm Eastern for calls (virtual or in-person meetings also available).
5. Once an appointment is confirmed, wrap up warmly.

Critical SMS rules:
- Every message must be 1–3 SHORT sentences. This is SMS — brevity is essential.
- Never be pushy, salesy, or repeat the same pitch twice.
- Be empathetic — many sellers have stressful situations (divorce, foreclosure, inherited property, etc.).
- If they say "stop", "unsubscribe", "remove me", or "not interested", respond once to politely acknowledge and do not follow up.
- Do NOT mention the property address unless the contact brings it up first.

Special markers (append to the end of your reply when appropriate — these will be stripped before sending):
- When an appointment is confirmed: [APPOINTMENT_SCHEDULED: <day and time the contact agreed to>]
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
// SmarterContact API helpers
//
// SmarterContact REST API base: https://app.smartercontact.com/api/v1
// Auth: Bearer token (your API key from Settings → Integrations → API)
//
// If the endpoint shape differs from what you see in your SC account,
// update SEND_URL and the request body below to match your SC API docs.
// ---------------------------------------------------------------------------
const SC_BASE = "https://app.smartercontact.com/api/v1";
const SC_KEY = process.env.SMARTER_CONTACT_API_KEY;
const SC_FROM = process.env.SMARTER_CONTACT_FROM_NUMBER;

async function sendSmarterContactMessage(contactId, message) {
  const url = `${SC_BASE}/contacts/${contactId}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SC_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message, from_number: SC_FROM }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SmarterContact send failed (${res.status}): ${body}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json());

// Allow the Vite dev server (port 5173) and any prod origin to hit the API
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
// Configure this URL in SmarterContact:
//   Settings → Integrations → Webhooks → Inbound Message Webhook
//   URL: https://your-server.com/webhook/smartercontact
//
// Expected payload (SmarterContact standard inbound webhook):
// {
//   "contact_id":    "123456",
//   "contact_phone": "+19198001234",
//   "contact_name":  "Jane Smith",
//   "message":       "Hey, what's this about?",
//   "direction":     "inbound",   // "inbound" | "outbound"
//   "campaign_id":   "789"
// }
// ---------------------------------------------------------------------------
app.post("/webhook/smartercontact", async (req, res) => {
  // Acknowledge immediately so SC doesn't retry due to timeout
  res.json({ received: true });

  const {
    contact_id,
    contact_phone,
    contact_name,
    message,
    direction,
  } = req.body;

  // Only handle inbound (replies from contacts)
  if (direction && direction !== "inbound") return;

  const id = String(contact_id || contact_phone || "").trim();
  if (!id || !message?.trim()) return;

  // Init conversation record if new
  if (!conversations[id]) {
    conversations[id] = {
      id,
      contactPhone: contact_phone || id,
      contactName: contact_name || "Unknown",
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
    saveConversations(conversations);
    return;
  }

  // Append inbound message
  convo.history.push({ role: "user", content: message.trim() });
  convo.lastActivity = new Date().toISOString();

  try {
    const rawReply = await generateReply(convo.history);

    // Parse special control markers from Claude's reply
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

    // Append outbound reply to history
    convo.history.push({ role: "assistant", content: cleanReply });
    convo.status = newStatus;
    convo.appointmentTime = appointmentTime;
    convo.lastActivity = new Date().toISOString();

    saveConversations(conversations);

    // Fire reply back through SmarterContact
    await sendSmarterContactMessage(id, cleanReply);
  } catch (err) {
    console.error("[webhook] error:", err.message);
    convo.history.push({ role: "assistant", content: "[ERROR — reply not sent]" });
    saveConversations(conversations);
  }
});

// ---------------------------------------------------------------------------
// REST API — consumed by the frontend dashboard
// ---------------------------------------------------------------------------

// GET /api/conversations  — list all, newest first
app.get("/api/conversations", (req, res) => {
  const list = Object.values(conversations).sort(
    (a, b) => new Date(b.lastActivity) - new Date(a.lastActivity)
  );
  res.json(list);
});

// GET /api/conversations/:id  — single conversation with full history
app.get("/api/conversations/:id", (req, res) => {
  const convo = conversations[req.params.id];
  if (!convo) return res.status(404).json({ error: "Not found" });
  res.json(convo);
});

// POST /api/conversations/:id/pause
app.post("/api/conversations/:id/pause", (req, res) => {
  const convo = conversations[req.params.id];
  if (!convo) return res.status(404).json({ error: "Not found" });
  convo.status = "paused";
  saveConversations(conversations);
  res.json(convo);
});

// POST /api/conversations/:id/resume
app.post("/api/conversations/:id/resume", (req, res) => {
  const convo = conversations[req.params.id];
  if (!convo) return res.status(404).json({ error: "Not found" });
  convo.status = "active";
  saveConversations(conversations);
  res.json(convo);
});

// GET /api/stats  — summary counts for dashboard cards
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

app.listen(PORT, () => {
  console.log(`Wholesale HQ AI server → http://localhost:${PORT}`);
  console.log(`Webhook endpoint        → POST http://localhost:${PORT}/webhook/smartercontact`);
});
