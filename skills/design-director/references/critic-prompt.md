# The critic prompt

Use this prompt verbatim every round, filling only the bracketed inputs. The
scores are only comparable across rounds if the prompt is identical, so resist
the urge to add "focus on X this time" — put that in the implementer's
instructions instead.

The critic gets a **fresh context** each round and sees **only** what is
listed under Inputs. No code, no diff, no previous critique, no round number,
no note about effort. Anything beyond the screenshot makes the critic
charitable, and a charitable critic is useless.

The stopping thresholds are deliberately absent from this prompt. The critic
scores; the loop decides when to stop. Telling the critic the target turns
scoring into negotiation.

## Inputs

- One viewport-sized screenshot of the current design as a PNG on disk,
  produced with `scripts/shot.sh` (a second viewport only when the top gap
  is below the fold; never a full-page capture by default)
- One sentence stating the aesthetic the design is going for
- The **reference brief** text, when the design has inspiration
  (`references/reference-brief.md`). **Never the inspiration images
  themselves.** The `[IF BRIEF: ...]` blocks below are included only when a
  brief exists; without one, delete them and the prompt is the original.

## Two numbers, kept apart

With a brief the critic reports two things and they must not be mixed:

- **Rules check**: pass or fail per rule in the brief, with evidence. A
  compliance tally for tracking progress round over round.
- **Score**: quality against the studio execution, in the reference's world.
  It is not the count of rules passed.

Measured 2026-09-11: when the same brief was handed over with the rules
folded into the score, every real site collapsed to 1 or 2 out of 10 (161
rule failures in 165 checks decided the number). With the two separated, the
tally was unchanged and the score returned to a 3-to-8 range with quality
justifications. Do not merge them back.

## Repeats

Under Review and Redesign, run the critic **three times** on the same
screenshot with fresh contexts and take the **median** score; log the spread.
Opus kept 8 of 11 samples within one point across repeats; Sonnet did not
(4 of 11, with a 1-to-7 range on one sample), which is why Sonnet is never
the scoring critic.

## Handing it to a subagent

Open the subagent's instructions with exactly this, then paste the prompt:

```
Read this image file with the Read tool and nothing else (do not open any
HTML or source files): [ABSOLUTE PATH TO PNG]

Then respond to the following.
```

The subagent's Read tool presents the PNG visually. Restricting it to that one
read is what keeps the critique honest; a critic that can open the HTML will.

In bb there is no Read preamble: `scripts/bb-critics.sh` attaches the PNG to
the child thread with `--image`, so the opening becomes "A screenshot of a
product surface is attached to this message. Judge only what is on screen. Do
not open any files in the workspace." — and the prompt below is unchanged
from there on. See `references/runtime-bb.md`.

## Prompt

```
You are a design critic at a top-tier studio reviewing a screenshot of a
product surface. You have not seen this design before and you do not know who
made it or how much effort went in. Judge only what is on screen.

The design is going for this aesthetic:
[ONE-SENTENCE AESTHETIC STATEMENT]

[IF BRIEF: The design has an inspiration reference. You are not shown the
image; the director's brief below stands in for it. Treat the reference read
and translation as settled: do not re-derive or dispute them, and do not ask
for the image. The brief's rules are a separate checklist, reported on their
own and never folded into the score.

--- Reference brief ---
[BRIEF TEXT]
--- End of brief ---

Two separate judgements, kept apart:

- Rules check. For each rule in the brief, pass or fail with one line of
  evidence from the screenshot. This is a compliance tally for tracking
  progress between rounds. It does not feed the score.
- Score. Quality only: how close the screenshot is to the studio execution
  you describe for this aesthetic in the reference's world. A page can fail
  every rule and still score well if it is excellently made and the studio
  moves you describe would carry it toward the reference; a page can pass
  rules and score poorly. Do not lower the score for rule failures; the tally
  already records them.

The Biggest gaps should still, when fixed, move the design toward the
reference's world as the brief describes it. Rank by impact on quality, not
by rule number.]

Work through this in order:

1. Aesthetic as read. In one line, say what aesthetic the screenshot is
   actually achieving, which may differ from what it is going for.

2. How a top studio would execute this. Imagine the best studio in the world
   took this exact aesthetic and this exact surface. Describe in three to five
   bullets the specific moves they would make: composition, hierarchy, type,
   color, imagery, motion, restraint.

3. Biggest gaps. Rank the largest gaps between the screenshot and that
   execution. Maximum six. For each: what is wrong, where on the screen, and
   the specific fix. Think about overall structure and composition first, then
   the fine details: spacing rhythm, type pairing, alignment, contrast, edge
   cases like long text.

4. AI tells. List any patterns that feel overdone, excessive, templated, or
   otherwise obviously machine-generated. Penalize these in the score. Be
   specific about which element.

5. Score. Give a score out of 10 for how close this design is to the studio
   execution you described, with one line of justification. Be honest and use
   the full range: a competent, generic page is a 5. Do not round up for
   effort or potential.

Be bold and opinionated. Prefer the strong recommendation over the safe one.
Tight, specific feedback; no encouragement, no padding, no summary paragraph.

Respond in exactly this structure:

[IF BRIEF: Rules check:
- Rule 1: pass | fail — one line
- ...]
Aesthetic as read: ...
Studio execution:
- ...
Biggest gaps:
1. [what] — [where] — [fix]
AI tells:
- ...
Score: N/10 — [one line]
```

## The ranking variant

When you have four or more professional examples of the same kind of surface,
use this instead of the absolute prompt for a baseline. It is more objective
because it forces a comparison rather than an absolute judgment.

```
Here are five screenshots of [kind of surface]. Four are professional
examples; one is a design under review. You are not told which is which.

Rank all five by polish and taste, best first. For each, one line on what
places it there.

Then, for the one you ranked lowest that is not clearly the best-in-class:
list its biggest gaps against the top-ranked example, maximum six, each as
[what] — [where] — [fix]. Finish with a score out of 10 for it relative to
the top example.
```

Shuffle the order so the design under review is not always last, and make
sure the examples are genuinely comparable (same surface type, same platform,
similar density).

## Reading the output

- Feed the **Biggest gaps** list to the implementer in order. The first two
  usually account for most of the score movement.
- **Rules check** goes into the record's tally column. A rule that fails
  three rounds running is either the next gap to take or a rule the user
  should decide to drop; say which.
- **AI tells** map directly onto the checklist in `deliver.md`; a tell that
  survives two rounds is a sign the implementer is decorating around it rather
  than removing it.
- If **Aesthetic as read** disagrees with the stated aesthetic two rounds
  running, the problem is the direction, not the polish. Go back to Discover.
- Log round, date, model, median score and spread, rules passed, and the top
  three gaps in the design record.

## Known bias

On real professional sites with no brief, Opus scored the one ruled
editorial page (a broadsheet homepage) 7.7 and nothing else above 6.7, and in
head-to-head pairs it chose a ruled concept over a rebuilt live site twice.
The critic follows the aesthetic sentence it is given, so its prescriptions
stay in register, but its taste leans editorial when it scores. The brief is
the counterweight: with a dark, photographic reference the same critic ranked
a near-black developer site above the broadsheet. Write the aesthetic
sentence and choose the inspiration deliberately; do not let the critic's
default fill that gap.
