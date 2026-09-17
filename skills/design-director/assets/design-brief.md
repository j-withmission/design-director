# Design record: [title]

Slug: `[slug]`
Created: [YYYY-MM-DD]
Status: discover | define | deliver | shipped | parked

## Surfaces

Which screens, pages, or artboards this record covers. One line each, with
the route or file.

-

## Aesthetic statement

One sentence. This is the line the critic receives every round, so make it
about feeling and identity, not features. Example: "A field notebook from a
1970s geological survey, precise and a little weathered."

>

## Seed and derived direction

Seed: `[output of scripts/seed.sh — never shown in the design]`

How the seed was read:

| Seed feature | Read as |
|---|---|
| | |

Resulting direction (palette, layout principle, type, motif, motion):

## Inspiration and the reference brief

Inspiration images, any kind, saved under `docs/design/refs/`. The critic
never sees them; it sees the brief written from them
(`references/reference-brief.md` in the design-director skill).

| Image | Kind (photo / painting / product surface / other) | What it is here for |
|---|---|---|
| | | |

Brief: `docs/design/briefs/[slug].md` · source: images | current page | both | declined · model: · date: · hash:

Regenerating the brief (new images) starts a new baseline; scores across
briefs are not comparable.

## Baseline

One row per surface. The baseline is the median of three critic scores from
the last accepted Review or Redesign round, valid only for the configuration
in the row.

| Surface | Baseline (median) | Rules passed | Brief hash | Critic model | Date | Set by (round) |
|---|---|---|---|---|---|---|
| | | | | | | |

## Directions explored

Every direction rendered in Discover, including the ones not chosen. Keep the
screenshots; they are the fastest way to explain the decision later.

| Name | Seed | One line | Screenshot | Chosen? |
|---|---|---|---|---|
| | | | | |

Why the chosen one won, in the user's words if possible:

## Critic history

One row per Review or Redesign round. The critic prompt is
`references/critic-prompt.md` in the design-director skill and is not changed
between rounds. Score is the median of three repeats; spread is min–max.
Rules passed is the brief's tally and never feeds the score.

| Round | Date | Tier | Critic model | Score (median) | Spread | Rules passed | Top 3 gaps |
|---|---|---|---|---|---|---|---|
| 0 (baseline) | | | | | | | |
| 1 | | | | | | | |

Stopped because: [baseline + 1 reached / two rounds without a point / plateau over three rounds / reached 9]

## Spot log

One row per spot check (`references/spot-check.md`). Pair verdict compares
against the previous row's screenshot.

| Date | Surface | Pair verdict (better / same / worse, margin) | Rules passed | Top nudge | Applied? | Screenshot |
|---|---|---|---|---|---|---|
| | | | | | | |

## Media generated

Images, video, or textures produced for the design, how they were made, and
where they live. Note the provider and model so they can be regenerated.

| Asset | Provider / model | Prompt summary | Path |
|---|---|---|---|
| | | | |

## Cut in Deliver

What was removed, and what would have broken if it stayed (usually nothing).
This list is the evidence that a subtraction pass happened.

-

## States

Each designed state, with a screenshot path. Missing rows mean missing
screens.

| State | Screenshot |
|---|---|
| Default | |
| Empty | |
| Loading | |
| Error | |
| Partial | |

## Lighthouse

One row per web surface, run after the critic loop and the subtraction pass.
Accessibility must be 90 or above before sign-off; the other three are
reported. Report files live next to the screenshots.

| Surface | Date | Perf | A11y | Best practices | SEO | Fixed after run | Report |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

## Rejected prompts

Directions that sounded wrong, were tried, and failed on the model of the day.
Keep every one. Retry them when a newer model ships; the ones that fail
hardest are often the ones that work first.

| Prompt (short) | Model tried | Date | Why rejected | Retry when |
|---|---|---|---|---|
| | | | | |

## Open questions

Decisions deferred to the user, or things the critic kept flagging that the
team chose to keep.

-
