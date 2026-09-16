#!/usr/bin/env bash
# Render a page to a PNG on disk for the critic and the design record.
# Usage: shot.sh <url-or-file> <out.png> [width] [height]
#
# The critic must see a file, not a live tab: a PNG path is the only thing you
# can hand to a fresh subagent without leaking code or context. The in-app
# preview pane cannot screenshot file:// pages and cannot save screenshots to
# disk, so this uses headless Chrome directly. Local HTML files work as-is;
# pages that need a server can be served with `python3 -m http.server`.
set -eu
src="${1:?url or html file}"
out="${2:?output png}"
w="${3:-1280}"
h="${4:-1200}"

case "$src" in
  http://*|https://*|file://*) url="$src" ;;
  *) url="file://$(cd "$(dirname "$src")" && pwd)/$(basename "$src")" ;;
esac

chrome=""
for c in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium" \
  "$(command -v google-chrome 2>/dev/null || true)" \
  "$(command -v chromium 2>/dev/null || true)"; do
  [ -n "$c" ] && [ -x "$c" ] && chrome="$c" && break
done
[ -n "$chrome" ] || { echo "no Chrome/Chromium found; screenshot in the preview browser and describe it instead" >&2; exit 2; }

mkdir -p "$(dirname "$out")"
# --renderer-process-limit and the heap cap keep one shot from eating a
# laptop. macOS has no `timeout`, so the watchdog is a background wait: a hung
# page can never leave Chrome running.
"$chrome" --headless=new --disable-gpu --hide-scrollbars \
  --disable-extensions --disable-background-networking --mute-audio \
  --renderer-process-limit=1 --js-flags=--max-old-space-size=256 \
  --window-size="${w},${h}" --virtual-time-budget=4000 \
  --screenshot="$out" "$url" >/dev/null 2>&1 &
pid=$!
for _ in $(seq 1 60); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
kill -0 "$pid" 2>/dev/null && { kill -9 "$pid"; echo "shot.sh: chrome hung after 60s, killed" >&2; exit 3; }
wait "$pid" || exit $?
echo "$out"
