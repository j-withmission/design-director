#!/usr/bin/env bash
# Collect a month's new sites from public design galleries and screenshot
# their homepages for the trends digest (references/trends.md).
# Usage: trends.sh <out-dir> [count]   (count default 30)
#
# Reads the listing URLs from ../trends/sources.md, fetches each listing page
# once with a browser user agent, takes the outbound site links, drops every
# host a previous run already shot (trends/*/manifest.tsv and trends/seen.txt),
# and shoots `count` new homepages round-robin across the galleries so no one
# gallery sets the month. Writes <out-dir>/manifest.tsv (host, source, shot)
# and <out-dir>/shots/<nn>-<host>.png, and appends the shot hosts to
# trends/seen.txt.
#
# robots.txt is respected for every gallery and every site: a `Disallow: /`
# in a group for `*` or for an Anthropic agent (ClaudeBot, Claude-User,
# Claude-Web, anthropic-ai) skips the host. A digest is read by a model, so
# a site that refuses Anthropic's crawlers is not read.
#
# bash, curl, grep, sed and awk only: the monthly cloud routine has those for
# sure. Chrome via shot.sh; without Chrome, Playwright's Chromium via npx.
#
# Exit codes: 0 at least five shots succeeded; 1 fewer than five; 2 bad
# usage, a missing sources file, or an out-dir that already has a manifest.
set -eu

usage() { echo "usage: trends.sh <out-dir> [count]" >&2; exit 2; }
[ $# -ge 1 ] && [ $# -le 2 ] || usage
out="$1"
count="${2:-30}"
case "$count" in ''|*[!0-9]*) echo "trends.sh: count must be a positive integer" >&2; exit 2 ;; esac
[ "$count" -ge 1 ] || { echo "trends.sh: count must be at least 1" >&2; exit 2; }

here="$(cd "$(dirname "$0")" && pwd)"
trends_dir="$(cd "$here/../trends" 2>/dev/null && pwd)" || { echo "trends.sh: no trends/ directory next to scripts/" >&2; exit 2; }
sources="$trends_dir/sources.md"
seen="$trends_dir/seen.txt"
[ -r "$sources" ] || { echo "trends.sh: sources file not readable: $sources" >&2; exit 2; }
[ -x "$here/shot.sh" ] || { echo "trends.sh: shot.sh not found next to this script" >&2; exit 2; }
[ -f "$seen" ] || printf '# Hosts already shot by trends.sh, one per line. Appended on every run.\n' > "$seen"

manifest="$out/manifest.tsv"
[ -e "$manifest" ] && { echo "trends.sh: $manifest already exists; remove $out to re-run this month" >&2; exit 2; }
shots="$out/shots"
mkdir -p "$shots"
work="$(mktemp -d "${TMPDIR:-/tmp}/trends.XXXXXX")"
trap 'rm -rf "$work"' EXIT

UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"

# Hosts that are never a site to read: social and app stores, the galleries
# themselves, site builders' own pages, and asset or analytics hosts. Matched
# against the host without "www.", exactly or as a parent domain.
DENY="twitter.com x.com instagram.com facebook.com fb.com linkedin.com
youtube.com youtu.be vimeo.com tiktok.com threads.net bsky.app reddit.com
medium.com discord.com discord.gg t.me spotify.com patreon.com
dribbble.com behance.net github.com gitlab.com producthunt.com
apps.apple.com itunes.apple.com play.google.com
godly.website siteinspire.com lapa.ninja land-book.com minimal.gallery
httpster.net onepagelove.com saaspo.com awwwards.com darkmodedesign.com
mobbin.com refero.design pageflows.com cssdesignawards.com thefwa.com
recent.design webflow.com framer.com readymag.com wix.com squarespace.com
wordpress.org wordpress.com figma.com notion.so creativecommons.org
plausible.io gmpg.org w3.org schema.org googletagmanager.com
google-analytics.com googleapis.com gstatic.com cloudflare.com
cloudfront.net amazonaws.com website-files.com rocketcdn.me wp.com
framerusercontent.com cloudinary.com imgix.net jsdelivr.net unpkg.com
typekit.net"

# robots_blocked <host>: true when robots.txt says `Disallow: /` to `*` or to
# an Anthropic agent. No robots.txt, or an HTML page in its place, is allowed.
# Kept simple on purpose: only a whole-site disallow counts.
robots_blocked() {
  body="$(curl -sfL -m 15 -A "$UA" "https://$1/robots.txt" 2>/dev/null || true)"
  [ -n "$body" ] || return 1
  case "$body" in *"<html"*|*"<HTML"*|*"<!DOCTYPE"*|*"<!doctype"*) return 1 ;; esac
  printf '%s\n' "$body" | tr 'A-Z' 'a-z' | tr -d '\r' | awk '
    /^[ \t]*user-agent[ \t]*:/ {
      ua = $0; sub(/^[^:]*:[ \t]*/, "", ua); sub(/[ \t#].*$/, "", ua)
      if (!collecting) applies = 0
      collecting = 1
      if (ua == "*" || ua == "claudebot" || ua == "claude-user" || ua == "claude-web" || ua == "anthropic-ai") applies = 1
      next
    }
    /^[ \t]*(dis)?allow[ \t]*:/ {
      collecting = 0
      if (applies && $0 ~ /^[ \t]*disallow[ \t]*:[ \t]*\/[ \t]*(#.*)?$/) blocked = 1
      next
    }
    END { exit blocked ? 0 : 1 }'
}

# --- 1. sources -------------------------------------------------------------
# A source is any table row in sources.md whose cells hold an http(s) URL; the
# first URL in the row is the listing page.
grep -E '^\|.*https?://' "$sources" | while IFS= read -r row; do
  printf '%s\n' "$row" | grep -oE 'https?://[^ |)>]+' | head -1
done > "$work/sources.txt"
nsrc="$(wc -l < "$work/sources.txt" | tr -d ' ')"
[ "$nsrc" -gt 0 ] || { echo "trends.sh: no listing URLs in $sources" >&2; exit 2; }
echo "sources: $nsrc in $sources"

# --- 2. candidates per source -----------------------------------------------
# The extraction regex: href=, an optional quote, http:// or https://, then
# the host characters [A-Za-z0-9.-]. The match stops at the first character
# that cannot be in a host (/ : ? # quote), so paths, ports, queries and
# fragments are dropped and what is left is the host. The homepage is what
# gets shot.
i=0
: > "$work/candidates.tsv"
while IFS= read -r url; do
  i=$((i + 1))
  src="$(printf '%s' "$url" | sed -E 's#^https?://##; s#[/:?\#].*##' | tr 'A-Z' 'a-z')"
  if robots_blocked "$src"; then
    echo "skip source $src: robots.txt disallows it" >&2
    continue
  fi
  if ! curl -sfL -m 20 -A "$UA" -o "$work/src-$i.html" "$url" 2>/dev/null; then
    echo "skip source $src: listing fetch failed ($url)" >&2
    continue
  fi
  grep -oE "href=[\"']?https?://[A-Za-z0-9.-]+" "$work/src-$i.html" \
    | sed -E "s#^href=[\"']?https?://##" | tr 'A-Z' 'a-z' \
    | awk -v s="$i" -v src="$src" -v deny="$(echo $DENY)" '
      BEGIN { n = split(deny, d, " "); for (k = 1; k <= n; k++) if (d[k] != "") den[d[k]] = 1
              sk = src; sub(/^www\./, "", sk) }
      function denied(h,   p) {
        p = h
        while (index(p, ".") > 0) { if (p in den) return 1; sub(/^[^.]*\./, "", p) }
        return 0
      }
      {
        h = $0; sub(/\.$/, "", h); key = h; sub(/^www\./, "", key)
        if (key !~ /\.[a-z][a-z]+$/) next                          # no TLD
        if (key == sk || substr(key, length(key) - length(sk)) == "." sk) next  # the gallery itself
        if (denied(key)) next
        if (key ~ /^(cdn|assets?|static|fonts?|img|images|media|files)[0-9]*\./) next
        if (key ~ /(^|\.)(google|pinterest)\.[a-z.]+$/) next
        if (seen[key]++) next
        print s "\t" (++r) "\t" h "\t" src
      }' >> "$work/candidates.tsv" || true
  found="$(awk -F'\t' -v s="$i" '$1 == s' "$work/candidates.tsv" | wc -l | tr -d ' ')"
  echo "source $src: $found candidate sites"
  [ "$found" -gt 0 ] || echo "  (nothing extracted; the listing may render client-side or link only to detail pages)" >&2
done < "$work/sources.txt"

# --- 3. drop hosts seen before ----------------------------------------------
{
  grep -v '^#' "$seen" 2>/dev/null || true
  for m in "$trends_dir"/*/manifest.tsv; do
    [ -f "$m" ] && awk -F'\t' 'FNR > 1 { print $1 }' "$m"
  done
} | sed -E 's/^www\.//' | awk 'NF' > "$work/seen.keys"

# --- 4. round-robin order ---------------------------------------------------
# Rank is the position on its own gallery's page, so sorting by rank then
# source interleaves the galleries: every gallery's first site, then every
# second, and so on. A host listed by two galleries goes to the earlier one.
sort -t "$(printf '\t')" -k2,2n -k1,1n "$work/candidates.tsv" \
  | awk -F'\t' 'FILENAME == ARGV[1] { seen[$1] = 1; next }
      { key = $3; sub(/^www\./, "", key); if (key in seen) next; seen[key] = 1; print $3 "\t" $4 }' \
      "$work/seen.keys" - > "$work/ordered.tsv"
avail="$(wc -l < "$work/ordered.tsv" | tr -d ' ')"
echo "new hosts available: $avail (asked for $count)"

# --- 5. check, shoot, record ------------------------------------------------
printf 'host\tsource\tshot\n' > "$manifest"
use_pw=0
pw_ready=0
shoot_pw() {
  if [ "$pw_ready" -eq 0 ]; then
    command -v npx >/dev/null 2>&1 || { echo "trends.sh: no Chrome and no npx; cannot shoot" >&2; return 1; }
    echo "no Chrome found; installing Playwright's Chromium once (npx -y playwright@1.49.1 install chromium)" >&2
    npx -y playwright@1.49.1 install chromium </dev/null >&2 || { echo "trends.sh: Playwright Chromium install failed" >&2; return 1; }
    pw_ready=1
  fi
  npx -y playwright@1.49.1 screenshot --browser chromium --viewport-size=1280,1200 \
    --wait-for-timeout=4000 "$1" "$2" </dev/null >/dev/null 2>&1
}

taken=0
ok=0
failed=0
while IFS="$(printf '\t')" read -r host src; do
  [ "$taken" -lt "$count" ] || break
  # A host that refuses Anthropic's agents, or that does not answer 2xx to a
  # plain browser request (dead, parked, behind a bot challenge), is passed
  # over for the next candidate rather than counted as a failed shot.
  if robots_blocked "$host"; then echo "skip $host: robots.txt disallows it" >&2; continue; fi
  code="$(curl -sL -m 20 -A "$UA" -o /dev/null -w '%{http_code}' "https://$host/" 2>/dev/null || true)"
  case "$code" in 2??) ;; *) echo "skip $host: HTTP ${code:-none}" >&2; continue ;; esac

  taken=$((taken + 1))
  nn="$(printf '%02d' "$taken")"
  png="$shots/$nn-$host.png"
  result="failed"
  if [ "$use_pw" -eq 0 ]; then
    rc=0
    "$here/shot.sh" "https://$host/" "$png" 1280 1200 </dev/null >/dev/null || rc=$?
    if [ "$rc" -eq 2 ]; then use_pw=1; fi
    [ "$rc" -eq 0 ] && [ -s "$png" ] && result="$nn-$host.png"
  fi
  if [ "$use_pw" -eq 1 ] && [ "$result" = "failed" ]; then
    shoot_pw "https://$host/" "$png" && [ -s "$png" ] && result="$nn-$host.png"
  fi
  if [ "$result" = "failed" ]; then
    failed=$((failed + 1)); echo "shot $nn failed: $host" >&2
  else
    ok=$((ok + 1)); echo "shot $nn: $host ($src)"
    printf '%s\n' "$host" >> "$seen"
    # A 1280x1200 PNG under 25 KB is nearly one flat colour: usually an intro
    # or a loader caught at the 4 s budget. Kept, and named, so the digest
    # writer reads it as that and not as the page's design.
    if [ "$(wc -c < "$png" | tr -d ' ')" -lt 25600 ]; then
      echo "  shot $nn is under 25 KB; likely an intro or loader frame" >&2
    fi
  fi
  printf '%s\t%s\t%s\n' "$host" "$src" "$result" >> "$manifest"
done < "$work/ordered.tsv"

# --- 6. report --------------------------------------------------------------
echo
echo "manifest: $manifest"
echo "shots:    $shots"
echo "shot: $ok   failed: $failed   asked: $count"
if [ "$ok" -lt 5 ]; then
  echo "trends.sh: only $ok shot(s) succeeded; a digest needs at least five. Check the sources and the skips above." >&2
  exit 1
fi
exit 0
