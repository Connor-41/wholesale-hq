#!/usr/bin/env bash
# Installs the nightly deal-filter cron job at 11:59 PM every day.
# Run once: bash scripts/setup_cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$(command -v python3)"
LOG_FILE="$SCRIPT_DIR/filter_deals.log"
CRON_ENTRY="59 23 * * * ANTHROPIC_API_KEY=\$ANTHROPIC_API_KEY $PYTHON $SCRIPT_DIR/filter_deals.py >> $LOG_FILE 2>&1"

# Write ANTHROPIC_API_KEY into the cron entry using the current shell env
CRON_ENTRY="59 23 * * * ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-YOUR_KEY_HERE} $PYTHON $SCRIPT_DIR/filter_deals.py >> $LOG_FILE 2>&1"

# Append only if not already present
( crontab -l 2>/dev/null | grep -v "filter_deals.py"; echo "$CRON_ENTRY" ) | crontab -

echo "Cron job installed:"
echo "  $CRON_ENTRY"
echo ""
echo "Verify with: crontab -l"
echo "Logs written to: $LOG_FILE"
