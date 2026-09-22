#!/usr/bin/env bash
# Run a design-director critic, spot check or brief pass as bb child threads.
#
# Usage:
#   bb-critics.sh --role critic|spot|brief --prompt-file <path> --out-dir <dir>
#                 [--repeats N] [--image <png>]... [--provider <id>]
#                 [--model <id>] [--reasoning <level>] [--timeout <seconds>]
#                 [--title <text>]
#
# Only runs inside a bb thread: it needs BB_THREAD_ID and BB_PROJECT_ID so the
# children can be parented to this thread and share its environment. In Claude
# Code, spawn subagents instead; see references/runtime-bb.md.
#
# Each repeat is a hidden child thread with a fresh context, spawned in the
# current environment (no worktree is provisioned), given the prompt file's
# text and any images as attachments. Output lands in <out-dir>/<role>-<n>.md.
# For --role critic the script also parses the "Score: N/10" line from each
# repeat and prints the configuration, the scores, the median and the spread.
#
# No `set -e`: a failing repeat must be named, not swallowed.
set -u

role=""
prompt_file=""
out_dir=""
repeats=1
provider=""
model=""
reasoning=""
timeout_s=900
title=""
images=()

die() { echo "bb-critics.sh: $*" >&2; exit 1; }

while [ $# -gt 0 ]; do
  case "$1" in
    --role)        role="${2:-}"; shift 2 ;;
    --prompt-file) prompt_file="${2:-}"; shift 2 ;;
    --out-dir)     out_dir="${2:-}"; shift 2 ;;
    --repeats)     repeats="${2:-}"; shift 2 ;;
    --image)       images+=("${2:-}"); shift 2 ;;
    --provider)    provider="${2:-}"; shift 2 ;;
    --model)       model="${2:-}"; shift 2 ;;
    --reasoning)   reasoning="${2:-}"; shift 2 ;;
    --timeout)     timeout_s="${2:-}"; shift 2 ;;
    --title)       title="${2:-}"; shift 2 ;;
    -h|--help)     sed -n '2,20p' "$0"; exit 0 ;;
    *)             die "unknown argument: $1" ;;
  esac
done

case "$role" in
  critic|spot|brief) ;;
  "") die "--role is required (critic, spot or brief)" ;;
  *)  die "--role must be critic, spot or brief, not '$role'" ;;
esac
[ -n "$prompt_file" ] || die "--prompt-file is required"
[ -r "$prompt_file" ] || die "prompt file not readable: $prompt_file"
[ -n "$out_dir" ] || die "--out-dir is required"
case "$repeats" in ''|*[!0-9]*) die "--repeats must be a positive integer" ;; esac
[ "$repeats" -ge 1 ] || die "--repeats must be at least 1"

[ -n "${BB_THREAD_ID:-}" ] || die "not inside a bb thread (BB_THREAD_ID unset). In Claude Code, spawn subagents instead; see references/runtime-bb.md."
[ -n "${BB_PROJECT_ID:-}" ] || die "BB_PROJECT_ID unset; bb cannot spawn a child thread without a project."

BB="${BB_CLI:-bb}"
command -v "$BB" >/dev/null 2>&1 || [ -x "$BB" ] || die "bb CLI not found (tried '\$BB_CLI' then 'bb' on PATH)."

for img in ${images+"${images[@]}"}; do
  [ -r "$img" ] || die "image not readable: $img"
  case "$img" in /*) ;; *) die "image path must be absolute: $img" ;; esac
done

mkdir -p "$out_dir" || die "cannot create out dir: $out_dir"

# --- JSON helpers -----------------------------------------------------------
# node is already a requirement of this skill; python3 is the fallback.
NODE_SRC='let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{let d;try{d=JSON.parse(s)}catch(e){process.exit(9)}
const a=process.argv.slice(1),m=a[0];
if(m==="providers"){(d||[]).forEach(p=>{if(p&&p.available)console.log(p.id)})}
else if(m==="models"){(d||[]).forEach(x=>console.log([x.id,x.isDefault?"default":"-",x.defaultReasoningEffort||"-"].join("\t")))}
else if(m==="field"){let v=d;for(const k of a[1].split(".")){if(v==null)break;v=v[k]}if(v!=null)process.stdout.write(String(v))}});'
PY_SRC='import sys,json
d=json.load(sys.stdin); a=sys.argv[1:]; m=a[0]
if m=="providers":
    [print(p["id"]) for p in (d or []) if p.get("available")]
elif m=="models":
    [print("\t".join([str(x.get("id")),"default" if x.get("isDefault") else "-",str(x.get("defaultReasoningEffort") or "-")])) for x in (d or [])]
elif m=="field":
    v=d
    for k in a[1].split("."):
        v = v.get(k) if isinstance(v,dict) else None
    if v is not None: sys.stdout.write(str(v))'

if command -v node >/dev/null 2>&1; then
  jq_mode() { node -e "$NODE_SRC" -- "$@"; }
elif command -v python3 >/dev/null 2>&1; then
  jq_mode() { python3 -c "$PY_SRC" "$@"; }
else
  die "neither node nor python3 found; one is needed to read bb's JSON."
fi

# --- provider resolution ----------------------------------------------------
available="$("$BB" provider list --json 2>/dev/null | jq_mode providers)"
[ -n "$available" ] || die "no bb provider is available (\`$BB provider list --json\` returned none)."
has_provider() { printf '%s\n' "$available" | grep -qx "$1"; }

if [ -z "$provider" ] && [ -n "${DESIGN_DIRECTOR_PROVIDER:-}" ]; then
  provider="$DESIGN_DIRECTOR_PROVIDER"
  has_provider "$provider" || die "DESIGN_DIRECTOR_PROVIDER='$provider' is not an available provider. Available: $(echo $available)"
fi
if [ -n "$provider" ]; then
  has_provider "$provider" || die "provider '$provider' is not available. Available: $(echo $available)"
else
  if has_provider claude-code; then
    provider="claude-code"
  else
    provider="$("$BB" thread show "$BB_THREAD_ID" --json 2>/dev/null | jq_mode field thread.providerId)"
    if [ -z "$provider" ] || ! has_provider "$provider"; then
      provider="$(printf '%s\n' "$available" | head -1)"
    fi
  fi
fi

catalog="$("$BB" provider models "$provider" --json 2>/dev/null | jq_mode models)"
[ -n "$catalog" ] || die "no model catalog for provider '$provider'."
has_model() { printf '%s\n' "$catalog" | cut -f1 | grep -qx "$1"; }
default_model() { printf '%s\n' "$catalog" | awk -F'\t' '$2=="default"{print $1; exit}'; }
model_effort() { printf '%s\n' "$catalog" | awk -F'\t' -v m="$1" '$1==m{print $3; exit}'; }

# Role -> model. Only the Claude configuration is calibrated; see
# references/runtime-bb.md.
if [ -z "$model" ]; then
  case "$provider" in
    claude-code)
      case "$role" in
        brief)  model="claude-fable-5-1"; has_model "$model" || model="claude-opus-5[1m]" ;;
        critic) model="claude-opus-5[1m]" ;;
        spot)   model="claude-sonnet-5" ;;
      esac
      ;;
    codex)
      model="gpt-5.6-sol"
      [ -n "$reasoning" ] || case "$role" in
        brief|critic) reasoning="high" ;;
        spot)         reasoning="low" ;;
      esac
      ;;
    *)
      model="$(default_model)"
      ;;
  esac
  if ! has_model "$model"; then
    echo "bb-critics.sh: model '$model' is not in $provider's catalog; falling back to its default." >&2
    model="$(default_model)"
  fi
fi
[ -n "$model" ] || die "could not resolve a model for provider '$provider'."
has_model "$model" || die "model '$model' is not in $provider's catalog."
case "$model" in
  *haiku*) die "refusing to run role '$role' on '$model'; haiku is too small to hold a direction or a stable score." ;;
esac
[ -n "$reasoning" ] || reasoning="$(model_effort "$model")"
[ "$reasoning" = "-" ] && reasoning=""
configuration="$provider/$model${reasoning:+/$reasoning}"

prompt_text="$(cat "$prompt_file")"
[ -n "$prompt_text" ] || die "prompt file is empty: $prompt_file"
[ -n "$title" ] || title="design-director $role"

# --- spawn ------------------------------------------------------------------
spawned=()
cleanup() {
  for t in ${spawned+"${spawned[@]}"}; do
    [ -n "$t" ] && "$BB" thread stop "$t" >/dev/null 2>&1
  done
}
trap cleanup EXIT INT TERM

spawn_args=(--project "$BB_PROJECT_ID" --parent-self
            --provider "$provider" --model "$model"
            --permission-mode accept-edits --visibility hidden)
# Spawning into this thread's own environment means bb provisions no worktree:
# the critic reads a PNG, it does not need a checkout.
[ -n "${BB_ENVIRONMENT_ID:-}" ] && spawn_args+=(--environment "$BB_ENVIRONMENT_ID")
[ -n "$reasoning" ] && spawn_args+=(--reasoning-level "$reasoning")
for img in ${images+"${images[@]}"}; do spawn_args+=(--image "$img"); done

echo "configuration: $configuration"
echo "role: $role   repeats: $repeats   timeout: ${timeout_s}s"

started=()
for n in $(seq 1 "$repeats"); do
  raw="$("$BB" thread spawn \
    "${spawn_args[@]}" \
    --title "$title $n/$repeats" \
    --prompt "$prompt_text" \
    --json 2>&1)"
  id="$(printf '%s' "$raw" | jq_mode field id 2>/dev/null)"
  [ -n "$id" ] || id="$(printf '%s' "$raw" | jq_mode field thread.id 2>/dev/null)"
  if [ -z "$id" ]; then
    echo "bb-critics.sh: spawn $n/$repeats failed:" >&2
    printf '%s\n' "$raw" >&2
    spawned+=("")
    started+=(0)
    continue
  fi
  spawned+=("$id")
  started+=("$(date +%s)")
  echo "spawned $role $n/$repeats: $id"
done

# --- wait, collect ----------------------------------------------------------
outputs=()
scores=()
failures=0
i=0
for id in ${spawned+"${spawned[@]}"}; do
  i=$((i + 1))
  out_file="$out_dir/$role-$i.md"
  if [ -z "$id" ]; then
    outputs+=("(not spawned)")
    scores+=("")
    failures=$((failures + 1))
    continue
  fi
  wait_msg="$("$BB" thread wait "$id" --status idle --timeout "$timeout_s" 2>&1)"
  wait_rc=$?
  status="$("$BB" thread show "$id" --json 2>/dev/null | jq_mode field thread.status)"
  # A thread that errored (an expired provider login, a refusal) reports its
  # error text as its output, so never read output without checking status.
  if [ "$wait_rc" -ne 0 ] || [ "$status" != "idle" ]; then
    echo "bb-critics.sh: $role $i ($id) ended in status '${status:-unknown}', not idle." >&2
    [ -n "$wait_msg" ] && echo "  $wait_msg" >&2
    err="$("$BB" thread output "$id" --json 2>/dev/null | jq_mode field output | head -3)"
    [ -n "$err" ] && echo "  thread says: $err" >&2
    echo "  left in place for inspection: $BB thread log $id --all" >&2
    outputs+=("(${status:-unknown}: $id)")
    scores+=("")
    failures=$((failures + 1))
    continue
  fi
  elapsed=$(( $(date +%s) - ${started[$((i - 1))]} ))
  text="$("$BB" thread output "$id" --json 2>/dev/null | jq_mode field output)"
  if [ -z "$text" ]; then
    echo "bb-critics.sh: $role $i ($id) produced no output (\`$BB thread log $id --all\`)." >&2
    outputs+=("(no output: $id)")
    scores+=("")
    failures=$((failures + 1))
    continue
  fi
  printf '%s\n' "$text" > "$out_file" || { echo "bb-critics.sh: could not write $out_file" >&2; failures=$((failures + 1)); }
  outputs+=("$out_file")
  score=""
  if [ "$role" = "critic" ]; then
    # critic-prompt.md ends with: "Score: N/10 — [one line]"
    score="$(grep -oE 'Score:[[:space:]]*[0-9]+(\.[0-9]+)?[[:space:]]*/[[:space:]]*10' "$out_file" | tail -1 \
      | grep -oE '[0-9]+(\.[0-9]+)?' | head -1)"
    [ -n "$score" ] || echo "bb-critics.sh: no 'Score: N/10' line in $out_file" >&2
  fi
  scores+=("$score")
  echo "$role $i: $id  ${elapsed}s  ${score:+score $score/10  }-> $out_file"
  "$BB" thread stop "$id" >/dev/null 2>&1
  "$BB" thread archive "$id" >/dev/null 2>&1
done

# --- summary ----------------------------------------------------------------
echo
echo "--- $role summary ---"
echo "configuration: $configuration"
i=0
for p in ${outputs+"${outputs[@]}"}; do
  i=$((i + 1))
  s="${scores[$((i - 1))]}"
  echo "  $role-$i: ${s:+$s/10  }$p"
done

if [ "$role" = "critic" ]; then
  nums="$(printf '%s\n' ${scores+"${scores[@]}"} | grep -E '^[0-9]' | sort -n)"
  if [ -n "$nums" ]; then
    printf '%s\n' "$nums" | awk '{a[NR]=$1} END {
      n=NR; med = (n%2) ? a[(n+1)/2] : (a[n/2] + a[n/2+1]) / 2;
      printf "scores: "; for (i=1;i<=n;i++) printf "%s%s", a[i], (i<n?", ":"\n");
      printf "median: %s   spread: %s (%s-%s over %d repeat%s)\n", med, a[n]-a[1], a[1], a[n], n, (n==1?"":"s");
    }'
  else
    echo "scores: none parsed"
  fi
  echo "Log this line next to the score in the design record: configuration $configuration"
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures of $repeats repeat(s) failed; see the messages above." >&2
  exit 1
fi
exit 0
