#!/usr/bin/env bash
set -euo pipefail

export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/pi/.Xauthority}"
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/user/1000}"

KIOSK_URL="${KIOSK_URL:-http://127.0.0.1:5010}"

# Wait for local kiosk web app
for i in {1..60}; do
  if curl -fsS "${KIOSK_URL}" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

# Kill stale chromium instances
pkill -f chromium-browser || true
pkill -f chromium || true
sleep 1

exec /usr/bin/chromium-browser \
  --kiosk "${KIOSK_URL}" \
  --incognito \
  --noerrdialogs \
  --disable-infobars \
  --check-for-update-interval=31536000 \
  --disable-session-crashed-bubble \
  --disable-features=TranslateUI \
  --autoplay-policy=no-user-gesture-required
