# Design record: GitHub social preview

Slug: `social-preview`
Created: 2026-09-17
Status: shipped (signed off by the user 2026-09-17)
Tier: Redesign (chosen by the user at the gate)

## Surfaces

- GitHub social preview image, 1280×640 PNG:
  `design/social-preview/social-preview.png`, source `social-preview.html`.
  Uploaded by hand in the repo's Settings → General → Social preview; GitHub
  has no API for it.

## Aesthetic statement

> An optometrist's eye chart that tests the viewer, rows of capitals
> shrinking toward the fine print where the actual claim lives.

## Seed and derived direction

Seed (direction C): `yyEEILTV1XxNG1nbZscI8M2cTuEEqrDyGdMrVN28mgSGvQKZLojR8ap9FDrlkrcB`

| Seed feature | Read as |
|---|---|
| Dense capital runs (`ILTV`, `XxNG`, `EE`) | Rows of optotypes, tight rhythm |
| `Dr` twice, `28mg` | Clinical setting |
| Mostly uppercase | Institutional, printed-chart formality |

Resulting direction: a Snellen chart in a heavy slab face, warm white stock,
red and green acuity rules as the only color.

## Inspiration and the reference brief

Brief: none · source: declined (user, 2026-09-17). The critic worked from the
aesthetic sentence alone and no rules tally was kept.

## Baseline

| Surface | Baseline (median) | Rules passed | Brief hash | Critic model | Date | Set by (round) |
|---|---|---|---|---|---|---|
| social preview | 6 | n/a | none | opus | 2026-09-17 | Discover |

## Directions explored

| Name | Seed | One line | Screenshot | Median (spread) | Chosen? |
|---|---|---|---|---|---|
| A · Drawing sheet | `rJE9uL1DRggQqAU65poov9bhDIVo5hx6sejKSzQwHZ3Jxw5LLd6iJvRtehbVJbKM` | The critic loop drawn as an engineering schematic, a red "no code crosses" boundary | `social-preview/a-drawing-sheet.png` | 6 (5–6) | no |
| B · Scoreboard | `f61nGzeazxypcSGeVPd7IEbVCDpG5g4wbbMcxyGpQPv1WXbKvC4QkQxqMsVCMATV` | Three critic scores on split-flap panels, the median lit in orange | `social-preview/b-scoreboard.png` | 5 (5–5) | no |
| C · Eye chart | see above | The risky one: the claim lives on the 20/20 line | `social-preview/c-eye-chart-r0.png` | 6 (5–6) | yes |

Side by side: `social-preview/discover-compare.png`. The user picked C over A
on a tie.

## Critic history

Prompt: `references/critic-prompt.md`, unchanged. Three Opus repeats per round.

| Round | Date | Tier | Critic model | Score (median) | Spread | Rules passed | Top 3 gaps |
|---|---|---|---|---|---|---|---|
| 0 (Discover) | 2026-09-17 | Redesign | opus | 6 | 5–6 | n/a | Row widths bulge; uneven vertical rhythm; fine print not fine |
| 1 | 2026-09-17 | Redesign | opus | 5 | 4–6 | n/a | Rows barely shrink; claim set large; words, not optotypes |
| 2 | 2026-09-17 | Redesign | opus | 6 | 5–6 | n/a | Claim unreadable at feed size; narrow column wastes 2:1; three typefaces |
| 3 | 2026-09-17 | Redesign | opus | 6 | 5–6 | n/a | Side label repeats the chart; fine print not fine; D crowds the top |

Stopped because: plateau over three rounds (no round beat 6).

Finding worth keeping: without a brief the critics' prescriptions flipped
between rounds. Round 2 asked for the wide format to be used and the claim to
survive a thumbnail; round 3 asked to delete the side column and shrink the
claim below legibility. This is the drift the reference brief exists to
anchor. The user chose round 3 for thumbnail legibility.

## Spot log

| Date | Surface | Pair verdict | Rules passed | Top nudge | Applied? | Screenshot |
|---|---|---|---|---|---|---|
| 2026-09-17 | social preview | better than round 3, clear (sonnet, order randomized) | n/a | Lock the label lines to the chart's row baselines | yes | `social-preview/social-preview.png` |

Second nudge, not applied: step rows 6–7 down more gradually. Rows 6–7 stay
at 24 and 16 px so the claim survives a feed thumbnail.

## Media generated

None. Type only, system fonts (Rockwell, Avenir Next Condensed), rendered
with `scripts/shot.sh`.

## Cut in Deliver

- The second tagline sentence, "Its critic reads the screenshot, never the
  code", which repeated row 6.
- The all-caps, hyphen-wrapped title; the name is one line in the repo's own
  lowercase.
- The humanist body sans; two families remain.
- Earlier rounds: the mint ground, the double frame, the vignette, the
  monospace labels, the in-chart tagline row.

## States

A static image has no empty, loading, or error states. The variant that
matters is feed-thumbnail size.

| State | Screenshot |
|---|---|
| Default, 1280×640 | `social-preview/social-preview.png` |
| Feed thumbnail, 400×200 | `social-preview/social-preview-thumb.png` |

## Lighthouse

Skipped: the surface is a static image, not a web page.

## Rejected prompts

| Prompt (short) | Model tried | Date | Why rejected | Retry when |
|---|---|---|---|---|
| Stadium scoreboard with split-flap critic scores | session model (Opus 5) | 2026-09-17 | Lowest Discover median (5); the board read as UI tiles | A model that renders physical objects convincingly in HTML |
| Engineering drawing sheet of the critic loop | session model (Opus 5) | 2026-09-17 | Tied, not chosen | Anytime; critics' fixes were clear (schematic as hero, line weights) |

## Open questions

- Whether a brief (a real Snellen chart plus one product card) would stop the
  critic drift and move the score past 6.
