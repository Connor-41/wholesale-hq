#!/usr/bin/env python3
"""
Wholesale HQ — Nightly deal filter.

Scans trianglendbuyer@gmail.com for off-market real estate deal emails
received in the last 24 hours, scores each with Claude, and moves
"good" deals into the Gmail label "Good Deals" for morning review.

Run manually:   python3 scripts/filter_deals.py
Cron (11:59 PM): 59 23 * * * /usr/bin/python3 /path/to/scripts/filter_deals.py
"""

import os
import json
import base64
import logging
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

import anthropic
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ── Config ────────────────────────────────────────────────────────────────────
SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
CREDS_FILE = Path(__file__).parent / "gmail_credentials.json"   # OAuth client secret
TOKEN_FILE  = Path(__file__).parent / "gmail_token.json"        # saved user token
GOOD_LABEL  = "Good Deals"                                       # Gmail label name
HOURS_BACK  = 24                                                 # window to scan

CLAUDE_MODEL = "claude-sonnet-4-6"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Scoring prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a deal analyst for Connor Orcutt, a wholesale real estate investor
at Fort Rose Capital in North Carolina.

Connor buys off-market properties (typically distressed SFR, small multi, or land)
from motivated sellers or other wholesalers, then assigns them to cash buyers or
fixes-and-flips them. He targets properties where he can make $5,000–$50,000 in
assignment fees or net profit.

Your job: decide if an inbound email contains a GOOD deal worth Connor reviewing.

GOOD DEAL signals (any combination):
- Concrete property address in NC (or nearby markets he operates in)
- Seller asking price mentioned (especially if below market)
- ARV or estimated repair costs included
- "Motivated seller", "distressed", "as-is", "probate", "foreclosure", "cash only"
- Wholesale / assignment opportunity with clear numbers
- Sender is a known wholesaler or investor (not spam / generic marketing)
- Potential assignment fee likely $5k+ based on disclosed numbers

BAD / SKIP signals:
- Generic marketing blast with no specific property
- Retail MLS listing at full price
- Commercial property outside Connor's criteria
- Spam, unsubscribe notices, newsletters, coaching upsells
- Already-closed or expired deals
- No address and no financials

Respond with valid JSON only — no markdown, no preamble:
{
  "verdict": "GOOD" | "SKIP",
  "score": <integer 1-10>,
  "address": "<street address if found, else null>",
  "asking_price": "<price if found, else null>",
  "reason": "<1-2 sentence summary for Connor>"
}"""


# ── Gmail helpers ──────────────────────────────────────────────────────────────
def get_gmail_service():
    creds = None
    if TOKEN_FILE.exists():
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDS_FILE.exists():
                raise FileNotFoundError(
                    f"Gmail OAuth credentials not found at {CREDS_FILE}.\n"
                    "Download them from Google Cloud Console → APIs & Services → Credentials."
                )
            flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)
        TOKEN_FILE.write_text(creds.to_json())
    return build("gmail", "v1", credentials=creds)


def get_or_create_label(service, name: str) -> str:
    """Return the Gmail label ID for `name`, creating it if needed."""
    labels = service.users().labels().list(userId="me").execute().get("labels", [])
    for lbl in labels:
        if lbl["name"].lower() == name.lower():
            return lbl["id"]
    created = service.users().labels().create(
        userId="me",
        body={
            "name": name,
            "labelListVisibility": "labelShow",
            "messageListVisibility": "show",
            "color": {"backgroundColor": "#16a766", "textColor": "#ffffff"},
        },
    ).execute()
    log.info("Created Gmail label '%s' (id=%s)", name, created["id"])
    return created["id"]


def fetch_recent_emails(service, hours: int) -> list[dict]:
    """Return messages received in the last `hours` hours (up to 100)."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    after_ts = int(cutoff.timestamp())
    query = f"in:inbox after:{after_ts}"
    result = service.users().messages().list(
        userId="me", q=query, maxResults=100
    ).execute()
    return result.get("messages", [])


def get_email_text(service, msg_id: str) -> tuple[str, str]:
    """Return (subject, body_text) for a message."""
    msg = service.users().messages().get(
        userId="me", messageId=msg_id, format="full"
    ).execute()
    headers = {h["name"]: h["value"] for h in msg["payload"].get("headers", [])}
    subject = headers.get("Subject", "(no subject)")

    def extract_text(payload):
        parts = payload.get("parts", [])
        if not parts:
            data = payload.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            return ""
        text = ""
        for part in parts:
            if part.get("mimeType") == "text/plain":
                data = part.get("body", {}).get("data", "")
                if data:
                    text += base64.urlsafe_b64decode(data + "==").decode("utf-8", errors="replace")
            elif part.get("mimeType", "").startswith("multipart/"):
                text += extract_text(part)
        return text or ""

    body = extract_text(msg["payload"])
    return subject, body[:4000]   # cap at 4k chars to stay within token limits


def apply_label(service, msg_id: str, label_id: str):
    service.users().messages().modify(
        userId="me",
        id=msg_id,
        body={"addLabelIds": [label_id]},
    ).execute()


# ── Claude scoring ─────────────────────────────────────────────────────────────
def score_email(client: anthropic.Anthropic, subject: str, body: str) -> dict:
    content = f"Subject: {subject}\n\n{body}"
    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=256,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    raw = response.content[0].text.strip()
    # strip possible code-fence if Claude adds one despite instructions
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)
    return json.loads(raw)


# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    log.info("=== Wholesale HQ deal filter starting ===")
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if not anthropic_key:
        raise EnvironmentError("ANTHROPIC_API_KEY env var not set.")

    claude = anthropic.Anthropic(api_key=anthropic_key)
    gmail  = get_gmail_service()
    label_id = get_or_create_label(gmail, GOOD_LABEL)

    messages = fetch_recent_emails(gmail, HOURS_BACK)
    log.info("Found %d emails in the last %d hours", len(messages), HOURS_BACK)

    good, skipped, errors = 0, 0, 0
    for m in messages:
        msg_id = m["id"]
        try:
            subject, body = get_email_text(gmail, msg_id)
            result = score_email(claude, subject, body)
            verdict = result.get("verdict", "SKIP").upper()
            score   = result.get("score", 0)
            reason  = result.get("reason", "")
            address = result.get("address") or "—"
            asking  = result.get("asking_price") or "—"

            if verdict == "GOOD":
                apply_label(gmail, msg_id, label_id)
                good += 1
                log.info(
                    "GOOD  [%d/10] %-40s | addr=%-30s ask=%-12s | %s",
                    score, subject[:40], address, asking, reason,
                )
            else:
                skipped += 1
                log.debug("SKIP  [%d/10] %s", score, subject[:60])
        except Exception as exc:
            errors += 1
            log.warning("Error processing message %s: %s", msg_id, exc)

    log.info(
        "Done — %d good deal(s) labeled '%s', %d skipped, %d errors",
        good, GOOD_LABEL, skipped, errors,
    )


if __name__ == "__main__":
    main()
