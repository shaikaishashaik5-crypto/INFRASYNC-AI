#!/usr/bin/env bash
# INFRASYNC AI - one-command launcher for Ubuntu/Debian/macOS
set -e
cd "$(dirname "$0")"
if ! command -v python3 >/dev/null 2>&1; then
  sudo apt-get update && sudo apt-get install -y python3 python3-venv python3-pip
fi
if [ ! -d .venv ]; then
  python3 -m venv .venv 2>/dev/null || { sudo apt-get update && sudo apt-get install -y python3-venv python3-pip && python3 -m venv .venv; }
fi
. .venv/bin/activate
pip install -q --disable-pip-version-check -r requirements.txt
PORT="${PORT:-8000}"
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
echo ""
echo "  INFRASYNC AI is starting"
echo "  Local   : http://localhost:$PORT"
[ -n "$IP" ] && echo "  Network : http://$IP:$PORT   (open this on phones / other laptops on the same Wi-Fi)"
echo "  Manager PIN: ${MANAGER_PIN:-admin123}   Worker PIN: ${WORKER_PIN:-1234}"
echo ""
exec uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
