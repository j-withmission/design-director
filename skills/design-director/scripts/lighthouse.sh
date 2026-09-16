#!/usr/bin/env bash
# Run a Lighthouse audit and print a compact summary for the design record.
# Usage: lighthouse.sh <url-or-file> <out-dir> [min-accessibility] [desktop|mobile]
#
# Writes <out-dir>/lighthouse.json and <out-dir>/lighthouse.html, prints the
# four category scores and every failing accessibility / best-practices audit,
# and exits 1 when accessibility is below the threshold (default 90). Local
# HTML files are served on a temporary http.server because Lighthouse cannot
# audit file:// URLs. Desktop emulation by default to match shot.sh's 1280px
# viewport; pass "mobile" for Lighthouse's phone emulation. Requires Node and
# Chrome; Lighthouse runs via npx.
set -eu
src="${1:?url or html file}"
out="${2:?output dir}"
min_a11y="${3:-90}"
preset="${4:-desktop}"

mkdir -p "$out"
server_pid=""
cleanup() { [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null || true; }
trap cleanup EXIT

case "$src" in
  http://*|https://*) url="$src" ;;
  *)
    dir="$(cd "$(dirname "$src")" && pwd)"
    file="$(basename "$src")"
    port=$(python3 -c 'import socket;s=socket.socket();s.bind(("127.0.0.1",0));print(s.getsockname()[1])')
    (cd "$dir" && python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1) &
    server_pid=$!
    for _ in $(seq 1 20); do
      curl -fs "http://127.0.0.1:$port/$file" >/dev/null 2>&1 && break
      sleep 0.25
    done
    url="http://127.0.0.1:$port/$file"
    ;;
esac

preset_flag=""
[ "$preset" = "desktop" ] && preset_flag="--preset=desktop"
npx --yes lighthouse "$url" \
  --quiet $preset_flag \
  --chrome-flags="--headless=new --no-sandbox" \
  --only-categories=performance,accessibility,best-practices,seo \
  --output=json --output=html \
  --output-path="$out/lighthouse" >/dev/null 2>&1 || true

# Lighthouse names the files lighthouse.report.json / .report.html
[ -f "$out/lighthouse.report.json" ] && mv -f "$out/lighthouse.report.json" "$out/lighthouse.json"
[ -f "$out/lighthouse.report.html" ] && mv -f "$out/lighthouse.report.html" "$out/lighthouse.html"
[ -f "$out/lighthouse.json" ] || { echo "lighthouse produced no report for $url" >&2; exit 2; }

node - "$out/lighthouse.json" "$min_a11y" <<'EOF'
const fs = require("fs");
const [, , path, minA11y] = process.argv;
const r = JSON.parse(fs.readFileSync(path, "utf8"));
const pct = (c) => Math.round((r.categories[c]?.score ?? 0) * 100);
const scores = {
  performance: pct("performance"),
  accessibility: pct("accessibility"),
  "best-practices": pct("best-practices"),
  seo: pct("seo"),
};
console.log("Lighthouse " + r.lighthouseVersion + "  " + r.finalDisplayedUrl);
console.log("| Category | Score |");
console.log("|---|---|");
for (const [k, v] of Object.entries(scores)) console.log(`| ${k} | ${v} |`);

function failing(cat) {
  const refs = r.categories[cat]?.auditRefs ?? [];
  return refs
    .map((a) => r.audits[a.id])
    .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== "informative")
    .map((a) => {
      const n = a.details?.items?.length;
      return `- ${a.id}: ${a.title}` + (n ? ` (${n} element${n === 1 ? "" : "s"})` : "");
    });
}
for (const cat of ["accessibility", "best-practices", "seo"]) {
  const f = failing(cat);
  if (f.length) {
    console.log(`\nFailing ${cat} audits:`);
    f.forEach((l) => console.log(l));
  }
}
const perf = ["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time"]
  .map((id) => r.audits[id])
  .filter(Boolean)
  .map((a) => `- ${a.title}: ${a.displayValue ?? "n/a"}`);
if (perf.length) {
  console.log("\nPerformance metrics:");
  perf.forEach((l) => console.log(l));
}
if (scores.accessibility < Number(minA11y)) {
  console.log(`\nAccessibility ${scores.accessibility} is below the ${minA11y} gate.`);
  process.exit(1);
}
EOF
