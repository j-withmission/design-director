# The spot check

The cheapest tier. It runs at the end of any task that changed a screen,
before the task reports done, and its job is to nudge, not to grade. One
`sonnet` call, about 10 seconds and $0.03. It never produces a score.

## What it does

Given the fresh screenshot, the aesthetic sentence, and the reference brief
if one exists:

1. **Pairwise, when a previous screenshot of the same surface exists.** Show
   the previous and the new shot as A and B, in a random order, and ask which
   is closer to the studio execution. Measured 2026-09-11: on twenty
   before-and-after pairs with a known answer, Sonnet was right 20 of 20,
   gave the same verdict when A and B were swapped 12 of 12, and preferred
   the first-shown image exactly half the time, so there is no position bias
   to correct for. Opus matched it at twice the cost.
2. **Rules check.** Each rule in the brief, pass or fail with one line of
   evidence. Sonnet's verdicts agreed with the full Opus critic on 50 of 55
   rule checks, and were slightly more lenient (18 passes to 13), which is
   the right direction for something that runs constantly.
3. **At most two nudges**: what, where, the fix. Same top nudge across three
   repeats on every sample tested, with the same hex value and the same
   region each time.

## Procedure

0. **Brief check.** Look for this surface's brief as `SKILL.md` describes.
   If there is none and the record has no recorded decline, ask the brief
   question once, write the brief if the user wants one, and log the answer.
   On an autonomous run, skip the question and note the missing brief in
   the final message.
1. Screenshot with `scripts/shot.sh` at the viewport size the surface was
   last shot at. Look at it yourself first; a clipped label or an unloaded
   font is a bug, fix it before spending anything.
2. Find the previous shot for this surface in the design record's spot log
   (or the last review round). If there is none, skip the pairwise step.
3. Spawn a `sonnet` subagent, fresh context, instructions beginning with the
   Read-only preamble used by the critic, the new PNG path (and the previous
   PNG path for the pairwise step), then the prompts below.
4. Log one row in the record's spot log: date, surface, pair verdict, rules
   passed, top nudge, screenshot path.
5. **Escalate** to a Review when any of these is true:
   - the pairwise verdict is "worse" with a `clear` margin;
   - a rule that passed in the last logged row now fails;
   - the same nudge has been logged three times without being applied.
   Otherwise apply the top nudge if it is a one-line change, and move on.

The spot check never edits the brief, never scores, and never runs more than
once per touch. If the surface has no brief and no aesthetic sentence, it
runs with the aesthetic sentence only and the rules step is skipped.

## Spot prompt

```
You are a design critic doing a thirty-second spot check on a screenshot of a
product surface that was just changed. You have not seen it before. Judge
only what is on screen. Be fast and specific; no essay.

The design is going for this aesthetic:
[ONE-SENTENCE AESTHETIC STATEMENT]

[IF BRIEF: The design has an inspiration reference. You are not shown the
image; the director's brief below stands in for it. Treat the reference read
and translation as settled. Check the brief's rules one by one, then give
the nudges.

--- Reference brief ---
[BRIEF TEXT]
--- End of brief ---]

Give at most two nudges: the two changes that would most move this screen
toward the aesthetic[IF BRIEF: and the brief's world]. Each nudge is one
line: what is wrong, where on screen, the specific fix. Structure and
composition before detail. If nothing is worth changing, say "none".

Do not give a score. No summary, no encouragement.

Respond in exactly this structure:

[IF BRIEF: Rules check:
- Rule 1: pass | fail — one line of evidence
- ...]
Nudges:
1. [what] — [where] — [fix]
2. [what] — [where] — [fix]
```

## Pairwise prompt

Preamble names two files: "Screenshot A: [path]  Screenshot B: [path]".
Randomize which is the previous shot; map the verdict back afterwards.

```
You are a design critic at a top-tier studio comparing two screenshots of the
same product surface, labeled A and B. One may be an earlier or later version
of the other; you are not told which. Judge only what is on screen.

The design is going for this aesthetic:
[ONE-SENTENCE AESTHETIC STATEMENT]

[IF BRIEF: The design has an inspiration reference. You are not shown the
image; the director's brief below stands in for it. Treat the reference read
and translation as settled and judge closeness to the brief's world as well
as studio execution.

--- Reference brief ---
[BRIEF TEXT]
--- End of brief ---]

Decide which screenshot is closer to how a top studio would execute this
aesthetic on this surface. Composition and hierarchy first, then type,
color, spacing, and finish. Ignore differences that are only content or
scroll position unless they change the design. If the two are
indistinguishable in design quality, say so.

Respond in exactly this structure:

Verdict: A | B | same
Margin: none | slight | clear
Why: one line
Differences:
1. [what differs] — [where] — [which one handles it better]
2. ...
```

## Limits

- Pairwise is reliable for iterations of one direction. It is not a way to
  choose between two directions: on two real concept-versus-rebuild pairs,
  Opus picked the ruled editorial concept both times and Sonnet picked the
  rebuild both times. Direction choice belongs to the Redesign tier and the
  user.
- No score. Sonnet's absolute scores on identical input ranged from 1 to 7
  in the same run; a spot score would be noise people act on.
