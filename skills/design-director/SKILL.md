---
name: design-director
description: >-
  Run a design process — Discover, Define, Deliver — for a surface a person
  will look at: app screen, landing page, dashboard, internal tool, report,
  published artifact, component. Three tiers: a spot check after any UI
  touch, a Review when a screen has slipped, a Redesign for new surfaces.
  Trigger when the user asks for design work by name: "make this look
  better", "less generic", "less AI-looking", "design critic", "critique /
  score this design", "spot check this screen", "has this dropped", "explore
  design directions", "give me options", "polish this", "simplify this", "add
  some personality", "retry the rejected directions", or when a task creates
  a new user-facing screen from scratch. The skill asks the user to confirm
  scope before spending anything beyond a spot check. Do not trigger for
  backend, library, data, or infra work, or for questions that can be
  answered in chat.
---

# Design director

## The three tiers

Every use of this skill is one of three jobs. Decide which before doing
anything else.

| Tier | When | What runs | Model | Stops when | Measured cost |
|---|---|---|---|---|---|
| **Spot check** | Any task touched a screen; runs at the end, before "done" | Pairwise against the last shot, rules check against the brief, at most two nudges. No score. | `sonnet` | Always one call | ~10 s, $0.03 |
| **Review** | A surface's baseline slipped: spot check escalated, or the user says "make this better" / "this looks off" | The critic loop below on the existing direction, three critic repeats per round, median score | `opus` critic, session model implements | Median ≥ baseline + 1, or two rounds without a full point | ~$0.35 and 2 min per round |
| **Redesign** | New surface, or the user wants the highest score the direction can reach | Reference brief, then Discover diverge (three seeded directions, each scored), then the critic loop to plateau | `fable` brief, `opus` critic, session model implements | Plateau: three rounds without a point, or 9/10 | ~$3–5 for three directions plus four rounds |

Spot check needs no permission; it is the price of touching a screen. Review
and Redesign go through the gate.

## Gate: confirm before spending anything beyond a spot check

Even at Review this process costs real tokens. **Do not read any reference
file, run any script, build any direction, or spawn any subagent until the
user has answered this question.** Ask it with AskUserQuestion as the very
first action after the skill loads, even when the user typed the skill name
themselves. The exception is a spot check, which runs without asking.

- Question: "Which tier of the design-director process do you want on this
  task?"
- Options, in this order:
  1. **Review** — keep the current direction, raise it back above its
     baseline. Up to two Opus critic rounds, viewport screenshots, states
     pass scoped to the task. (Formerly "Standard".)
  2. **Redesign** — brief from inspiration, three directions in Discover
     with the seed ceremony, critic rounds to plateau, every state and
     variant screenshotted. For new surfaces, shipped product surfaces and
     marketing pages. (Formerly "Full".)
  3. **Skip** — do the task without this skill. Still look at the rendered
     page before reporting done, show the user a screenshot, and run the
     spot check at the end.

Record the answer in the design record if one is created. If the run is
autonomous and nobody can answer, default to **Skip** and say so in the final
message; never default to Redesign.

Only after the answer, continue with the stage router below.

## Why this skill exists

Anshu Chimala's "How to turn your AI into a world-class designer" (Lenny's
Newsletter, Sep 2026) explains most bad AI UI: a model picks the most
probable token at every step, so left alone it produces design-by-committee —
the purple gradient, text left, graphic right, three feature cards. Four
things follow:

1. **Variety has to come from outside the model.** A real random seed does
   what asking for "unique" cannot.
2. **The agent cannot judge its own work.** A separate critic looking only at
   a screenshot can.
3. **AI adds and never subtracts.** Restraint has to be pushed for explicitly.
4. **Taste is the user's contribution.** The user's reactions make it theirs.

A fifth, measured on 2026-09-11 on a bench of eleven real sites, three
critic repeats each: **the critic needs an anchor it cannot
re-derive.** Handed a photograph it dismissed it; asked to translate it, two
models read it differently; given one cached brief written by a stronger
model, both read it the same way every time. And **a score is not a
checklist**: folding rule compliance into the score turned every real site
into a 1. The tiers, the brief, and the split score all come from that day.

The skill also keeps a per-design record so a design can be revisited,
re-scored, or have its rejected directions retried on a newer model.

## Stage router

Decide where to start before doing anything. Starting at Define on a surface
that never had a direction polishes slop; starting at Discover on a design
that already has an identity throws away work.

| Signal | Tier | Start at |
|---|---|---|
| A task changed a screen and is about to report done | Spot check | `references/spot-check.md`, no gate |
| Spot check escalated, or "make this better" on an existing design | Review | **Define**, with a baseline round first if the record has none |
| New surface, no stated aesthetic or reference | Redesign | **The reference brief** if inspiration exists, then **Discover** |
| A direction or brief exists, but the render looks like every AI page | Review | **Define** |
| The design has a clear identity; the ask is to ship it | Review | **Deliver** |
| "Retry the rejected prompts", "re-score this", "what did we try" | — | **The design record** (below) |
| "Lighthouse this", "audit accessibility", "is this page accessible" | — | **The Lighthouse pass** in Deliver, standalone, no gate question needed |
| A chart or dashboard is involved | any | Load `dataviz` first, then continue here |
| The output is a published artifact | any | Load `artifact-design` first, then continue here |

Read only the reference the current stage needs, when you reach that stage.

Small audience does not lower the bar. "Internal", "one user", and "pilot"
describe the infrastructure budget, not the interface.

## The reference brief

Read `references/reference-brief.md` when the design has inspiration images,
or when the user hands one over mid-task.

One `fable` pass over the inspiration set writes the reference read, a
translation into UI terms, and three to five checkable rules. That text is
saved to `docs/design/briefs/<slug>.md` with its hash, and **it is what the
critic and the spot check receive from then on. They never see the images.**
Any image is valid inspiration: a photograph, a painting, a poster, a product
surface. Mix in at least one product surface when you can; rules written
from a photograph alone are not satisfiable by real pages.

A new brief starts a new baseline. Regenerate only when the inspiration set
changes, never to get a better number.

## Discover — pick a direction (Redesign only)

Read `references/discover.md` when running this stage.

Write the brief first if there is inspiration. Then the ideation ladder and
at least three seeded directions, each built and screenshotted, presented
side by side with a one-line aesthetic statement each. Include one that
seemed too risky.

**Score every direction before asking.** Each direction gets one Review
critic round: three `opus` repeats, median logged. Show the user the three
shots with their medians and rules tallies, and ask which to pursue. The
score informs; the user chooses. If nobody can answer, take the highest
median, and where two are within a point take the one that least resembles
a default page, and mark the record "chosen by agent". The critic leans
editorial when it scores (see `critic-prompt.md`); a ruled direction that
wins by less than a point has not really won.

Don't "imagine" a seed string; run `scripts/seed.sh`. The point is that the
entropy is not the model's. Never show or hint at the string in the design.

Record the chosen direction, its seed, every discarded one with its score,
and the brief hash in the design record before moving on.

Under Review there is no Discover: the direction is the one the surface has.

## Define — give the design an identity

Even seeded designs lean on stale scaffolding: nav bar up top, hero text left
with a button under it, graphic right. This stage is where the design stops
being "an AI page with a nice palette" and becomes its own thing.

### The critic loop

The implementing agent cannot grade its own work: it sees its code and its
rationale and grades on effort. A separate critic sees only what a user sees.

Each round:

1. **Screenshot to disk** with `scripts/shot.sh <url-or-file> <out.png>`.
   For pages behind a login use `scripts/shoot-auth.mjs <outDir> <baseUrl>
   <route...>` with `SHOT_EMAIL` / `SHOT_PASSWORD` (seed credentials from
   the repo, never the user's own): one Chrome per run, many routes, killed
   on every exit path. `SHOT_WIDTH=390` for mobile, `SHOT_DARK=1` for dark.
   Viewport-sized (1280×1200 for web is the script default), not full page;
   a full-page PNG costs several times the tokens and rarely changes the
   critique. Shoot a second viewport only when the top gap is below the fold.
   For a simulator, use its screenshot action and save the PNG.
2. **Look at the screenshot yourself first.** Overflow, clipped labels,
   overlapping elements, and unloaded fonts are bugs, not design gaps. Fix and
   re-shoot before spending the critic.
3. **Spawn the critic three times** as `opus` subagents (fall back to a
   second `opus` attempt, not `sonnet`; Sonnet's scores are unstable), fresh
   context each, in parallel; critics are cheap. Each gets: the Read-only
   preamble, the PNG path, the aesthetic statement, and the **brief text**
   if one exists. No inspiration images, code, implementation notes,
   previous critiques, round number, or effort.
4. **Use the fixed prompt** in `references/critic-prompt.md`, unchanged from
   round to round, or the scores stop being comparable. Take the median
   score; take the gaps from the median critique; log the spread and the
   rules tally.
5. **Apply the top gaps, subtraction first.** Treat each gap as a diagnosis,
   not a prescription: when the critic says "add a section", ask whether
   removing or restructuring something solves the same gap. An added section
   is the next round's AI tell. A rule that fails is a to-do for the tally,
   not a reason the score is low; fix it when it is also a gap.
6. **Repeat**, within the cap.

Stopping rules, fixed before round one:

- **Review:** stop when the median is at least one point above the surface's
  baseline, or after two rounds that did not gain a full point. Report the
  score history, the rules tally, and remaining gaps to the user and stop.
  More rounds only when the user asks.
- **Redesign:** stop at 9/10, or when three consecutive rounds fail to raise
  the median by a point. Update the baseline row with the final median.
- **Read the top gap's altitude.** If the highest-ranked gap is about
  composition or structure, a polish round will not move the score; change
  the layout or go back to Discover.
- **Never tell the critic the target score or the baseline.**
- **Scores compare only within one configuration**: same prompt, same
  critic model, same brief hash. Changing any of them starts a new baseline
  row; say so in the record.

When four or more professional examples of the same surface exist, the
ranking variant in the critic prompt is a better baseline round than the
absolute one.

Log every round in the design record: round, date, tier, model, median score
and spread, rules passed, top three gaps.

### Generated media

Read `references/media-generation.md` only when the critic flags flat or
fake-rich visuals, or when the direction obviously wants imagery. Look for
`.env.agents` in the repo root; if there is no key, say so in one line and
use the fallbacks in that reference. Do not stall or ask the user to paste a
key into chat.

## Deliver — polish into something people will use

Read `references/deliver.md` when running this stage.

**Subtract first.** For every element ask: *what breaks if this is gone?* If
"nothing", it goes. Glows, gradient backdrops, labels that repeat an image,
containers around single items, decorative dividers, a subhead under every
headline.

**Prefer native components.** On iOS, iOS controls. On the web, the design
system if there is one.

**Remove the AI tells** using the checklist in the reference. The checklist
is a subtraction list, and subtraction alone converges on hairlines and
whitespace. The brief's translation is the positive vocabulary; when the
brief calls for filled cards, soft radii, or a saturated field, those are
not tells on this surface.

**Design the states that the task touches.** Empty, loading, error, partial,
and "nothing to do here" are designed screens. Under Review, build and
screenshot the states the task actually introduces or changes, and list the
others as unstyled in the final message rather than reporting the surface
complete. Under Redesign, every state gets built and screenshotted, plus
long-text, narrow-viewport, and dark-mode variants.

### Lighthouse pass

Runs once per web surface after the critic loop and the subtraction pass,
before anything goes to the user. It is mechanical, not aesthetic: the critic
judges taste, Lighthouse catches the things taste misses — contrast ratios,
missing labels and alt text, tap-target size, heading order, layout shift,
and a page made slow by generated media. Skip it with one line for
non-web surfaces (simulator, native).

1. Run `scripts/lighthouse.sh <url-or-file> <out-dir>` against the default
   state. Local files are served automatically; pages that need the app
   running get the dev server URL. Output is a scores table, the failing
   accessibility / best-practices / SEO audits, and the core performance
   metrics; the full JSON and HTML reports land in `<out-dir>`.
2. **Accessibility is a gate at 90.** Fix every failing accessibility audit
   in the design's own vocabulary (the accent that fails contrast gets a
   darker step of the same hue, not gray), re-run once, and stop. This is
   mechanical work; a `sonnet` subagent may do it. Do not spend a critic
   round on it, and do not let the fixes reintroduce a tell.
3. **The other three are reported, not gated.** Performance below 80 on a
   page that gained generated media or motion means the media is too heavy;
   compress, lazy-load, or add a poster frame before sign-off. Best-practices
   and SEO failures get fixed when the fix is a one-liner and listed
   otherwise.
4. Log the scores in the design record's Lighthouse table and include the
   table in the final message with the screenshots.

The script emulates desktop by default to match the 1280px screenshots.
Under Redesign, or when the surface is mobile-first, run it a second time
with `mobile` as the fourth argument and log both rows.

**Show the user before any PR.** Screenshot every touched surface and get
their judgement. Never track design status on the PR itself.

**End with a spot check.** Every tier, every task that touched a screen: the
spot check's row is the last thing added to the record before "done".

In a repo that keeps decision records, design decisions go in `docs/design/`.

## The spot check

Read `references/spot-check.md`. One `sonnet` call at the end of any task
that changed a screen, whether or not the skill was otherwise invoked:
pairwise against the last screenshot of that surface, the brief's rules
tally, and at most two nudges. No score. Apply the top nudge if it is a
one-line change. Escalate to a Review when the pairwise verdict is clearly
"worse", a rule regressed, or the same nudge has been logged three times.

## The design record

Every design gets a record, created at Discover (or at the first Review) and
updated through Deliver. Copy `assets/design-brief.md` to:

- `docs/design/<slug>.md` when the repo has a `docs/` directory
- `design/<slug>.md` when it doesn't
- the scratchpad for a one-off artifact, mentioned in the final message

It tracks the aesthetic statement, the inspiration set and brief hash, the
seed and direction, directions explored with screenshots and scores, the
**baseline** per surface, the critic history with median, spread and rules
tally, the spot log, what was cut in Deliver, and a **rejected prompts**
table with the model and date each was tried. Models improve every few
months; a direction that failed on today's model may work on the next one.

When the user says "retry the rejected directions", "re-score this", or "what
did we try on this page": read the record first, then act. Re-scoring is one
Review critic round (three repeats) against a fresh screenshot, appended to
the history and compared to the baseline row with the same brief hash.
Retrying is running the rejected prompts through the current model and
updating the table.

## Model roles

| Role | Model | Why (measured 2026-09-11) |
|---|---|---|
| Reference brief | `fable`, else `opus` | Written once, read hundreds of times; the two-image brief resolved a dark photograph against a light page into one coherent direction with attainable rules |
| Spot check, pairwise | `sonnet` | 10 s and $0.03; 20/20 on known regressions, no order bias, 91% rule agreement with the Opus critic |
| Scoring critic (Review, Redesign) | `opus`, three repeats, median | Widest useful range (3–8) and 8 of 11 samples within a point across repeats; Sonnet compressed to 3–6 and bounced 1–7 on one sample |
| Critic synthesis pass | none | A Fable pass over Sonnet plus Opus critiques sharpened the gap text but left the score where it was, at six times the cost |
| Ideation (Discover) | the session model | Needs the user's context and taste |
| Implementer | the session model, or `sonnet` for mechanical rounds | Must execute a direction well |
| Implementer | never `haiku` | Too small to hold a direction across a page |

### Models

`fable`, `opus`, and `sonnet` are Claude Code subagent model aliases, passed
when spawning a subagent. Where `fable` is unavailable, use `opus` for the
reference brief. Never substitute `sonnet` for a scoring critic, and never
use `haiku` as an implementer.

## Resource budget (a laptop is the build machine)

A design pass once made a Mac unusable: seven implementers ran in parallel,
each with its own multi-process headless Chrome, each running `tsc`,
`eslint` and the full test suite at once against a single dev server that
recompiled on every edit, and one Chrome was never killed. These limits are
not advisory:

- **At most two implementers at a time.** Fan screen groups out in batches
  of two (`pipeline` over a list of pairs, or a `parallel` of two thunks per
  round). Critics are cheap and may run wider (three repeats in parallel is
  the norm); implementers may not.
- **One Chrome per screenshot run, never per agent.** Use the scripts here;
  they cap renderers, cap the heap, and kill Chrome in `finally` and on
  signals. Never launch Chrome by hand from an agent prompt.
- **Checks scale with ownership.** An implementer runs `tsc --noEmit` and
  `eslint` on its own files. Exactly one agent — the last one, or the
  Deliver pass — runs the full test suite and the build.
- **Sweep before you report.** End every workflow with `pgrep -f
  remote-debugging-port` and kill anything the run started. An orphaned
  headless Chrome from a dead agent was found six days later.
- If the run needs more than four implementers to finish in reasonable
  time, that is a sign to serialize by screen, not to widen.

## What not to do

- Don't skip the gate, and don't run Redesign because it seems warranted;
  the user chooses. The spot check is the only thing that runs unasked.
- Don't run more than two implementers at once or launch a Chrome per agent;
  see Resource budget.
- Don't hand the critic code, diffs, previous critiques, or the inspiration
  images. It gets the screenshot, the aesthetic sentence, and the brief.
- Don't reuse a critic context across rounds or across repeats.
- Don't edit the critic prompt or regenerate the brief mid-loop to get a
  better score.
- Don't fold the rules tally into the score, or read a score as a tally.
- Don't use `sonnet` for a score, and don't put a score in a spot check.
- Don't compare scores across different prompts, critic models, or briefs.
- Don't fake richness with glows, gradient orbs, or blurred blobs.
- Don't "imagine" a seed string. Run the script.
- Don't report a screen as done because tests pass. Done is when the user has
  seen the screenshot, the spot check has run, and the user has said so.
- Don't let "internal" or "pilot" talk you into browser defaults.
