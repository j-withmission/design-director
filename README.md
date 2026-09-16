# design-director

A design process for Claude Code, for any surface a person will look at: an app
screen, a landing page, a dashboard, an internal tool, a report. It runs a
separate critic that sees only a screenshot, never the code, so the agent is not
grading its own work. It has three cost tiers, from a three-cent spot check that
runs after any UI change to a full redesign with seeded directions. When the
design has inspiration images, one strong model writes a cached reference brief
once and every critic reads that text instead of the pictures. Every design keeps
a record on disk with its baseline score, its critic history, and the directions
that were rejected, so a surface can be re-scored later or retried on a newer
model. The framework comes from Anshu Chimala's ["How to turn your AI into a
world-class designer"](https://www.lennysnewsletter.com/p/how-to-turn-your-ai-into-a-world)
(Lenny's Newsletter, Sep 2026); the tiers, the brief, and the split score come
from measuring it.

## What's different

The measurements below come from a bench of eleven real sites run on 2026-09-11,
three critic repeats per sample. The bench itself is not in this repo: it is
built from screenshots of third-party sites.

**Sonnet is a reliable pairwise judge, and a terrible scorer.** On twenty
before-and-after pairs with a known answer it picked correctly 20 out of 20, gave
the same verdict when A and B were swapped 12 out of 12, and preferred the
first-shown image exactly half the time, so there is no position bias to correct
for. Opus matched it at twice the cost. But asked for an absolute score on
identical input in the same run, Sonnet ranged from 1 to 7. That split is why the
spot check is a Sonnet call that never produces a number, and why the scoring
critic is always Opus.

**Opus scores hold still enough to compare across rounds.** Across repeats, 8 of
11 samples stayed within one point on Opus. Sonnet managed 4 of 11 on the same
samples. A score you cannot reproduce cannot tell you whether a round helped.

**A score is not a checklist.** When the brief's rules were folded into the
score, every real site on the bench collapsed to a 1 or 2 out of 10: there were
161 rule failures in 165 checks, and the compliance tally swallowed the quality
judgement. Separating them left the tally unchanged and returned the score to a
3-to-8 range with quality justifications. The critic prompt here reports the two
separately and says not to merge them back.

**The critic needs an anchor it cannot re-derive.** Handed a photograph as a
moodboard, the critic dismissed it in 31 of 33 critiques and judged as if it were
not there. Told to translate the photograph itself, two models read it
differently and produced critiques asking for opposite palettes. Given one cached
brief written once by a stronger model, both models read the reference the same
way on every run, agreed on rule verdicts 91% of the time, and every sample held
a score spread of one point or less. So the brief is written once and the images
are never shown to a critic again.

**A synthesis pass is not worth it.** Running a Fable pass over the Sonnet and
Opus critiques sharpened the wording of the gaps but left the score exactly where
it was, at six times the cost. It is in the model table as a role with no model
assigned.

One more finding shapes the brief: rules written from a photograph alone were
unattainable by real pages, passing 4 times in 165 checks. Adding a single
product surface to the same inspiration set made them attainable without changing
what the score meant.

## The three tiers

| Tier | When | What runs | Model | Measured cost |
|---|---|---|---|---|
| **Spot check** | Any task touched a screen; runs at the end, before "done" | Pairwise against the last shot, rules check against the brief, at most two nudges. No score. | `sonnet` | ~10 s, $0.03 |
| **Review** | A surface's baseline slipped: spot check escalated, or the user says "make this better" / "this looks off" | The critic loop on the existing direction, three critic repeats per round, median score | `opus` critic, session model implements | ~$0.35 and 2 min per round |
| **Redesign** | New surface, or the user wants the highest score the direction can reach | Reference brief, then Discover diverge (three seeded directions, each scored), then the critic loop to plateau | `fable` brief, `opus` critic, session model implements | ~$3 to $5 for three directions plus four rounds |

## Install

```
npx skills add https://github.com/j-withmission/design-director --skill design-director
```

Or manually, cloning and symlinking so updates land by pulling:

```
git clone https://github.com/j-withmission/design-director.git
ln -s "$PWD/design-director/skills/design-director" ~/.claude/skills/design-director
```

## Requirements

- Claude Code. The skill spawns subagents and uses the model aliases `fable`,
  `opus`, and `sonnet`.
- Chrome or Chromium, either on `PATH` or installed in `/Applications`, for the
  screenshot scripts.
- Node 18 or newer for `shoot-auth.mjs`, which talks to Chrome over CDP.
- `npx lighthouse` for the accessibility gate. Nothing to install ahead of time;
  npx fetches it.
- Optional: image or video generation keys in a gitignored `.env.agents` at the
  repo root (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `FAL_KEY`). Without them the
  skill says so in one line and uses the documented fallbacks.

## How it runs

**The gate.** Anything past a spot check costs real money, so the skill asks
before spending it. The first thing it does after loading is ask which tier you
want: Review, Redesign, or Skip. It reads no reference file, runs no script, and
spawns no subagent until that is answered. On an autonomous run with nobody to
ask, it defaults to Skip.

**The spot check runs unasked.** It is the one thing that does not go through the
gate, because it is the price of touching a screen: one Sonnet call at the end of
any task that changed a surface, pairwise against the last screenshot, a rules
tally, and at most two nudges. It escalates to a Review when the pairwise verdict
is clearly worse, when a rule that used to pass now fails, or when the same nudge
has been logged three times without being applied.

**The critic never sees code.** Each round screenshots the surface to a PNG,
spawns three Opus critics with fresh contexts, and gives each one the image path,
the one-sentence aesthetic statement, and the brief text. No diffs, no previous
critiques, no round number, no target score. The prompt is fixed between rounds
so the numbers stay comparable.

**The design record.** Each design gets a Markdown record at
`docs/design/<slug>.md` (or `design/<slug>.md` in a repo with no `docs/`). It
holds the aesthetic statement, the seed and how it was read, the brief hash, the
baseline per surface, every critic round with median and spread, the spot log,
what was cut in Deliver, the Lighthouse scores, and a table of rejected prompts
with the model and date each was tried. That last table is why the record exists:
a direction that failed on this month's model is worth retrying on the next one.

**Resource budget.** At most two implementer agents at a time, and exactly one
headless Chrome per screenshot run rather than one per agent. The scripts cap
renderers, cap the heap, and kill Chrome on every exit path. The rule exists
because an earlier version of this process ran seven implementers with seven
Chromes and made the laptop unusable, and one of those Chromes was still running
six days later.

## Files

```
skills/design-director/
  SKILL.md                      the process: tiers, gate, stage router, model roles
  references/
    reference-brief.md          writing the cached brief from inspiration images
    discover.md                 seed strings, ambitious briefs, the ideation ladder
    critic-prompt.md            the scoring prompt, verbatim, plus the ranking variant
    spot-check.md               the spot and pairwise prompts
    deliver.md                  subtraction pass, the AI tells checklist, states
    media-generation.md         image and video generation, and fallbacks without keys
  assets/
    design-brief.md             the design record template
  scripts/
    seed.sh                     random seed string from /dev/urandom
    shot.sh                     headless Chrome screenshot to a PNG
    shoot-auth.mjs              screenshots behind a login, one Chrome per run
    lighthouse.sh               Lighthouse audit with an accessibility gate
```

[SKILL.md](skills/design-director/SKILL.md) is the actual process and is worth
reading before using it. This README does not repeat it.

## Credits

The framework and the four principles come from
Anshu Chimala's ["How to turn your AI into a world-class
designer"](https://www.lennysnewsletter.com/p/how-to-turn-your-ai-into-a-world).
Read it first; this skill is an implementation of it with a measured critic
attached.

MIT licensed. See [LICENSE](LICENSE).
