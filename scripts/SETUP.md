# Deal Filter — Setup Guide

Nightly script that scans `trianglendbuyer@gmail.com` for off-market real estate
opportunities, scores them with Claude AI, and labels the good ones **"Good Deals"**
so you see them first thing in the morning.

---

## One-time setup

### 1. Install Python dependencies

```bash
pip install -r scripts/requirements.txt
```

### 2. Enable the Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or reuse one)
3. Enable **Gmail API** under APIs & Services
4. Go to **Credentials** → Create → **OAuth 2.0 Client ID** → Desktop App
5. Download the JSON file and save it as `scripts/gmail_credentials.json`

> The first time you run the script it will open a browser window asking you to
> sign in to `trianglendbuyer@gmail.com` and grant access. After that a token is
> saved locally and re-runs are fully silent.

### 3. Set your Anthropic API key

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

Add that line to your `~/.zshrc` or `~/.bashrc` to persist it.

### 4. Test a manual run

```bash
python3 scripts/filter_deals.py
```

Watch the log output. Good deals get the green **"Good Deals"** label in Gmail.

### 5. Install the nightly cron job (11:59 PM)

```bash
bash scripts/setup_cron.sh
```

Verify it registered:

```bash
crontab -l
```

Logs are appended to `scripts/filter_deals.log`.

---

## How scoring works

Each email is passed to Claude with context about your wholesale criteria:

| Signal | Result |
|---|---|
| Specific NC address + motivated seller | GOOD |
| ARV / repair cost numbers present | GOOD |
| Wholesale assignment with $5k+ upside | GOOD |
| Generic marketing blast / no address | SKIP |
| Retail MLS listing at full price | SKIP |
| Spam / coaching upsell | SKIP |

Claude returns a score (1–10) and a one-line reason. Only scores marked **GOOD**
get the Gmail label.

---

## Files

| File | Purpose |
|---|---|
| `filter_deals.py` | Main script |
| `requirements.txt` | Python dependencies |
| `setup_cron.sh` | Installs the 11:59 PM cron job |
| `gmail_credentials.json` | **You create this** — OAuth client secret (gitignored) |
| `gmail_token.json` | Auto-created on first run — saved auth token (gitignored) |
| `filter_deals.log` | Nightly run logs |
