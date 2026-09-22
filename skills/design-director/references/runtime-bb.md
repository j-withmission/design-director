# Running in bb

This skill was written for Claude Code, where it asks questions with
AskUserQuestion and runs critics as subagents. In the bb agent orchestrator
neither exists, and the session may not be a Claude model at all. This file
is the mapping. Read it before spawning anything or asking the gate question.

## Detecting the runtime

`BB_THREAD_ID` is set in every bb thread. Set means bb; unset means Claude
Code (or a plain CLI session), and the rest of the skill applies unchanged.

bb also injects `BB_PROJECT_ID`, `BB_ENVIRONMENT_ID`, `BB_THREAD_STORAGE` (a
scratch directory) and `BB_CLI` (an absolute path to the bb CLI). Use
`"$BB_CLI"` when it is set, else `bb` on `PATH`. Never hardcode an app path.

bb reads `~/.claude/skills` as a shared skill root, so the install is the
same and the skill body is the same on every provider.

## The mapping

| Claude Code | bb |
|---|---|
| AskUserQuestion for the gate and brief questions | Native question on a provider with `supportsNativeUserQuestion`; otherwise a numbered list in chat, then end the turn (below) |
| Spawn a subagent with model `fable` / `opus` / `sonnet` | `scripts/bb-critics.sh`, which spawns hidden child threads and resolves the model per provider (below) |
| Critic reads the PNG with the Read tool | The PNG is attached to the child thread with `--image`; the Read-only preamble is replaced (below) |
| `pipeline` / `parallel` batching of implementers | Spawn at most two child threads at a time and wait on them; the two-implementer cap is unchanged |
| Three critic repeats in parallel | `bb-critics.sh --role critic --repeats 3`: three spawns, then three waits |
| The spot check "at the end" | Same: last thing before reporting done, `--role spot --repeats 1` |
| Subagent returns its text to the caller | `bb thread output <id> --json`; the script writes each to `<out-dir>/<role>-<n>.md` |

## Asking questions without AskUserQuestion

`bb provider list --json` reports `capabilities.supportsNativeUserQuestion`
per provider. Today `claude-code` is true; `codex`, `pi` and `acp-cursor` are
false.

Where it is false, ask in plain chat and **end the turn**. The user's reply
arrives as the next message. Keep the same questions and the same options in
the same order as `SKILL.md` — do not reword them to fit chat:

```
Which tier of the design-director process do you want on this task?
  1. Review — keep the current direction, raise it back above its baseline.
  2. Redesign — brief, three seeded directions, critic rounds to plateau.
  3. Skip — do the task without this skill.

This surface has no inspiration brief. How should I make one?
  1. Use the current page
  2. Current page plus my images
  3. I'll provide inspiration
  4. No brief
```

Read no reference, run no script and spawn no thread until the answer comes
back. On an autonomous run with nobody to answer, the default is **Skip**,
exactly as in Claude Code.

## Which provider the critic runs on

In order:

1. `DESIGN_DIRECTOR_PROVIDER`, if set.
2. `claude-code`, if `bb provider list --json` says it is available.
3. The session thread's own provider:
   `bb thread show "$BB_THREAD_ID" --json` → `.thread.providerId`.
4. The first available provider.

Then role to model, from `bb provider models <provider> --json`:

| Provider | Brief | Critic | Spot |
|---|---|---|---|
| `claude-code` | `claude-fable-5-1`, else `claude-opus-5[1m]` | `claude-opus-5[1m]` | `claude-sonnet-5` |
| `codex` | `gpt-5.6-sol`, reasoning high | `gpt-5.6-sol`, reasoning high | `gpt-5.6-sol`, reasoning low |
| anything else | the catalog's `isDefault` model at its `defaultReasoningEffort` | same | same |

Never `haiku`, on any role. `bb-critics.sh` refuses it.

### Only the Claude configuration is calibrated

Everything the README reports — Sonnet 20/20 pairwise, Opus scores holding
within a point across repeats, the 3-to-8 score range — was measured on
Claude models. A run on `codex`, `pi` or an ACP agent is a **different
configuration**, not a cheaper version of the same one. Its numbers are
internally comparable and nothing else: do not compare them with a Claude
score, and do not carry a baseline across providers.

So every baseline row, every critic round and every spot row in the design
record carries a **configuration** value next to the score:
`claude-code/claude-opus-5[1m]/high`, `codex/gpt-5.6-sol/high`. Changing the
provider or the model starts a new baseline row, the same as changing the
prompt or the brief hash. `bb-critics.sh` prints the string to paste.

## Spawning a critic

One critic is one hidden child thread:

```
"$BB_CLI" thread spawn \
  --project "$BB_PROJECT_ID" \
  --environment "$BB_ENVIRONMENT_ID" \
  --parent-self \
  --provider claude-code --model 'claude-opus-5[1m]' --reasoning-level high \
  --permission-mode accept-edits \
  --visibility hidden \
  --title "design-director critic 1/3" \
  --image /abs/path/to/shot.png \
  --prompt "$(cat prompt.txt)" \
  --json
```

- `--environment "$BB_ENVIRONMENT_ID"` puts the child in this thread's own
  workspace, so bb provisions **no worktree**. A critic reads a picture; it
  has no use for a checkout, and provisioning one per repeat is slow.
- `--parent-self` links it to this thread; `--visibility hidden` keeps three
  repeats out of the user's thread list.
- `--permission-mode accept-edits` is the floor, not a request for more. A
  child cannot exceed the parent's ceiling anyway.
- `--image` attaches the PNG. This replaces the Read-only preamble: on bb the
  critic's prompt opens with

  ```
  A screenshot of a product surface is attached to this message. Judge only
  what is on screen. Do not open any files in the workspace.
  ```

  and then the prompt from `critic-prompt.md`, **byte-identical** from there
  on. Attaching is what keeps the critic honest here, the way the single Read
  does in Claude Code.
- The prompt is the preamble, the critic prompt, the aesthetic sentence and
  the brief text. Still no code, no diff, no previous critique, no round
  number, no images of the inspiration.

Then, in order: spawn all three, `bb thread wait <id> --status idle --timeout
900 --json` on each, `bb thread output <id> --json` on each. Three spawns
then three waits, never spawn-wait-spawn: the repeats are meant to run at the
same time.

`scripts/bb-critics.sh` does all of this. Use the script; the recipe above is
what it runs, for when something needs debugging.

```
scripts/bb-critics.sh --role critic --repeats 3 \
  --prompt-file "$BB_THREAD_STORAGE/critics/round3.txt" \
  --image /abs/path/to/shot.png \
  --out-dir "$BB_THREAD_STORAGE/critics/round3"
```

It prints the configuration, each repeat's score, the median and the spread,
and the path of each critique. `--role spot` and `--role brief` take the same
flags with the role's model; `--provider`, `--model` and `--reasoning`
override the resolution above.

## When a child fails

`available: true` in the provider list means bb has the provider installed,
not that it is signed in. A provider whose login has expired spawns a thread
that goes straight to status `error` with "Failed to authenticate: OAuth
session expired", and `bb thread output` returns **that message as the
output**. So never read a child's output without checking
`bb thread show <id> --json` → `.thread.status` first; the script does.
`bb thread wait` helps here too: it exits non-zero immediately on an errored
thread rather than sitting out the timeout. The fix is the user's to make —
the provider's own hint says to run its CLI on the machine and sign in — so
report it in one line and do not retry the round.

bb also posts a `@thread:<id> completed` or `failed` system message into the
parent thread as each child lands. It is a notification, not a result: the
result is the script's summary and the files in `--out-dir`.

## Cleanup

- The script stops and archives every child that returned output, and leaves
  a child that timed out or failed running so its log can be read
  (`bb thread log <id> --all`). Stop those by hand once you have looked:
  `bb thread stop <id>` then `bb thread archive <id>`.
- The `pgrep -f remote-debugging-port` sweep at the end of a run still
  applies. Screenshots are taken by `scripts/shot.sh` in **this** thread, not
  in a child; a child that launches its own Chrome is the failure mode the
  resource budget exists to prevent.
- Nothing else changes: the two-implementer cap, one Chrome per screenshot
  run, and the "exactly one agent runs the full suite" rule are the same in
  bb.
