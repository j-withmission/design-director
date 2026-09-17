# The reference brief

One pass, on `fable`, over the inspiration images. It writes the reference
read, the translation into UI terms, and a short checklist, and that text is
what every critic and implementer gets from then on. **Critics never see the
inspiration images**; they see the brief.

## Why a brief instead of the images

Measured on 2026-09-11 on a bench of eleven real sites, three critic
repeats each:

- Handed a photograph as a moodboard, the production critic dismissed it in
  31 of 33 critiques ("sets no usable polish bar") and judged as if it were
  not there.
- Told to translate the photograph itself, Opus read it as a dark-ground
  image 25 times in 33 and Sonnet 24 times in 33; the misreads produced
  critiques asking for the opposite palette.
- With one cached brief, both models read the reference identically on
  every run, agreed on rule verdicts 91% of the time, and every sample had a
  score spread of one point or less across repeats.
- Rules written from a photograph alone were unattainable by real pages (4
  passes in 165 checks). Adding one product-surface reference to the same
  brief made them attainable (13 passes, Vercel 6 of 15) without changing
  the score's meaning.

So: one strong read, fixed for every critic and every round, from a mixed set
of references when possible.

## Where the inspiration comes from

The brief check in `SKILL.md` asks the user for one of three sources:

- **Inspiration images** the user supplies. Copy them into
  `docs/design/refs/`; download URLs there first, since the subagent reads
  files.
- **The current page.** Shoot it with `scripts/shot.sh <url-or-file>
  docs/design/refs/<slug>-current.png` at the surface's usual viewport (use
  `scripts/shoot-auth.mjs` behind a login). Look at the shot yourself first;
  a broken render makes a broken brief. The screenshot is the whole
  inspiration set.
- **Both.** The current-page screenshot plus the user's images, in one set.

When the set includes the current page, fill the `[IF CURRENT PAGE: ...]`
block in the prompt below with that file's name; otherwise delete the block.

A brief written from the page itself is not what the 2026-09-11 bench
measured, and it has two known weaknesses. Its rules tend to pass on the
page they were read from, so the tally starts high and moves little. And on
a page that already looks generic, it can write the generic defaults down as
the direction. Offer it for Review, where keeping the identity is the goal;
for Redesign, steer toward outside images.

## Colors from code

When the product already defines its colors in code, those values are the
palette. A model reading a screenshot estimates hex values, and on
2026-09-17 a brief written from a live page guessed a `#F4F3F0` background
and a `#B5602A` accent for a site whose stylesheet said `#ffffff` and
`#c65a2e`. Every critic then checked the page against the wrong colors.

Before writing any brief, look for the palette in code:

- **CSS custom properties** in the stylesheet the app actually loads (check
  the root layout or entry file's imports; skip legacy copies): `:root`,
  `.dark`, `[data-theme]`.
- **Tailwind**: `@theme` blocks in CSS (v4), or `theme.colors` and
  `theme.extend.colors` in `tailwind.config.*` (v3).
- **Token files**: `tokens.json`, `*.tokens.json`, Style Dictionary or
  Figma token exports.
- **Theme objects** in CSS-in-JS, MUI, Chakra, or styled-components.
- **Native**: iOS `*.colorset/Contents.json` and SwiftUI `Color`
  extensions, Android `res/values/colors.xml` and Compose `ColorScheme`,
  Flutter `ThemeData`.

Collect the semantic color tokens only: background, surface, text, muted
text, border or rule, accent, and state colors, with their values. Resolve
`var()` aliases to the final value, keep light and dark sets separate, and
leave out chart and syntax palettes unless the surface uses them. About
twenty tokens is plenty. Write them into the code palette block of the
prompt as `name: value, role`, taking the role from the token name or an
adjacent comment.

How the block is used depends on the source:

- **The current page is in the set:** the code values are authoritative.
  The brief uses them verbatim in its palette read, translation and rules.
- **Images only:** the code values are the product's current palette. The
  brief keeps them unless the images clearly call for a change, and says
  which in its Resolution.

No palette in code (a new project, or a one-off artifact): delete the block
and the brief reads colors from the images as before.

## Elements the owner keeps

A brief read from the current page will sometimes call a deliberate
element a defect: a watermark, an accent used at rest, an unusual label. On
2026-09-17 a site brief ruled out its own tree watermark and its clay
numerals, and every page failed two rules for it. When the owner confirms
that an element is part of the identity, list it in the
`[IF KEPT ELEMENTS: ...]` block, one line each, as they described it. The
brief then treats those elements as fixed and writes rules that allow
them. Record the list in the design record next to the brief line, and
regenerate the brief when it changes.

## Procedure

1. Collect the inspiration set from the source the user chose: one to four
   images, any kind (photograph, painting, poster, film still, a product
   surface, the current page). Prefer at least one product surface alongside
   any photograph; it is what makes the rules satisfiable. Save them under
   `docs/design/refs/` (or the record's folder).
2. Collect the code palette (above), and fill or delete the
   `[IF CODE PALETTE: ...]` block in the prompt. Do the same for the
   `[IF KEPT ELEMENTS: ...]` block.
3. Spawn a `fable` subagent (fall back to `opus`, never `sonnet`; the brief
   is read hundreds of times, so its quality is the cheapest place to spend).
   Its instructions begin:

   ```
   Read these image files with the Read tool and nothing else (do not open
   any HTML or source files), in this order: [ABSOLUTE PATHS]

   Then respond to the following.
   ```

   followed by the prompt below with the aesthetic sentence filled in.
4. Save the output verbatim to `docs/design/briefs/<slug>.md` with a header
   line recording date, model, source (images, current page, or both),
   palette source (code, with the file, or images), image file names, and a
   hash
   (`shasum -a 256` of the brief text, first 12 characters). Put the path and
   hash in the design record.
5. Regenerate only when the inspiration set, the code palette, or the kept
   elements change. A new brief starts a new
   baseline; scores across briefs are not comparable.

Cost: one call, about 60 seconds and $0.35 on `fable`.

## Prompt

Use verbatim. Works for one image or several; with one image the Resolution
section simply states that it governs every axis.

```
You are the design director at a top-tier studio. You have been handed one or
more inspiration images for a product surface. Your job is to write the
reference brief that every critic and implementer on the project will work
from instead of the images themselves, so it must be precise enough to stand
in for the pictures and it must resolve them into one direction.

A reference may be any kind of image: a photograph, a painting, a poster, a
film still, a product surface. Never dismiss a reference for not being a UI;
the job is to translate it. When one reference is itself a product surface,
it may lend concrete UI moves (type pairing, component shapes, layout), but it
is still inspiration, not a template to copy.

The surface it will inform is described as:
[ONE-SENTENCE AESTHETIC STATEMENT]

[IF CURRENT PAGE: One reference, [FILE NAME], is a screenshot of this surface
as it stands today. Read it for the identity worth keeping: the palette,
type, composition and material it is reaching for. Do not read its defects
as the direction. Where it shows generic defaults (centered hero over three
cards, gradient backdrops, a stock accent color), leave them out of the
resolution and write rules this screenshot's weakest regions would fail.
When other references are present, they set where the page is going and the
screenshot sets what it keeps.]

[IF CODE PALETTE: The product defines these colors in code, from
[FILE PATH]:
[TOKEN LIST, one per line as name: value, role]
[IF CURRENT PAGE: These values are authoritative. Use them exactly in the
palette read, the translation and the rules, naming the token for each
color. Never substitute a value estimated from the screenshot; where the
screenshot seems to show a different color, the code value wins.]
[IF IMAGES ONLY: These are the product's current colors. Keep them unless
the references clearly call for a change; for each color you replace, say
so in the Resolution and give the new value.]]

[IF KEPT ELEMENTS: The owner has confirmed these elements are part of the
identity and stay:
[ELEMENT LIST, one per line]
Treat them as settled. Describe them in the read, keep them in the
resolution and translation, and write no rule that fails them.]

Step 1. Read each image separately on five axes: palette, composition, focus,
density, light and material. Be concrete: approximate hex values, proportions
as percentages of the frame, positions as regions. Label each read with the
image's file name.

Step 2. Resolve. For each axis, decide which reference governs, or how they
combine, and say why in one line. Name conflicts explicitly (for example a
dark emissive photograph against a light matte page) and settle them; do not
average two palettes into mud. The result is one world, not two.

Step 3. Translate the resolved read into the vocabulary of a product surface,
one line per axis: palette becomes background, text and accent colors and
their proportions; composition becomes grid, hero placement and reading
order; focus becomes hierarchy; density becomes spacing rhythm and how many
elements share a viewport; light and material become depth cues, contrast
and finish. The surface should feel like it belongs to the resolved world,
not reproduce any picture.

Step 4. Rules. Three to five rules a critic can check a screenshot against
without seeing the images: one sentence each, testable, jointly satisfiable,
and specific to this resolved direction.

No preamble, no commentary. Respond in exactly this structure:

Reference read:
[file name 1]
- Palette: ...
- Composition: ...
- Focus: ...
- Density: ...
- Light and material: ...
[file name 2, if any]
- ...
Resolution:
- Palette: [which governs or how they combine] — [why]
- Composition: ...
- Focus: ...
- Density: ...
- Light and material: ...
Translation:
- Palette → ...
- Composition → ...
- Focus → ...
- Density → ...
- Light and material → ...
Rules:
1. ...
```

## Reading the brief

- **Translation** is what the implementer builds toward. It is the aesthetic
  statement made concrete.
- **Rules** are the checklist the spot check and the critic report on. They
  are a progress tally, never a score. A page can fail every rule and be
  well made; the score says so and the tally says what is still to do.
- If the Resolution section picked a governing reference the user did not
  intend, fix the inspiration set (drop or add an image) and regenerate;
  do not hand-edit the brief.
