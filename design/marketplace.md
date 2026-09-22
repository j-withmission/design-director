# Design record: BB marketplace listing

Slug: `marketplace`
Created: 2026-09-22
Status: awaiting sign-off (icon and screenshots shown to the owner 2026-09-22)
Tier: Spot check (assets derived from the shipped social-preview identity;
no critic loop was run)

## Surfaces

- Marketplace icon, single-color SVG masked by bb with the surrounding text
  color: `design/marketplace/icon/design-director-bca059af.svg` (working
  copy `icon.svg`, review sheet `contact-sheet.png`, explored variants and
  size ladders in `icon/variants/`).
- Three listing screenshots, real captures of bb's web UI at 1440 CSS px and
  device scale 2: `design/marketplace/screenshots/01-spot-check-thread.png`,
  `02-critic-child-thread.png`, `03-plugin-detail.png`.

Both are vendored into the get-bb/marketplace repository at submission time
(`icons/`, `screenshots/design-director/`); the copies here are the source.

## Aesthetic statement

> The top of the eye chart, reduced until only the first two lines survive.

Same identity as `design/social-preview.md`: Rockwell Bold optotypes, rows
shrinking, one acuity rule.

## Icon decisions

| Decision | Choice | Why |
|---|---|---|
| Rows | `D` over `E S` over one rule (variant B) | The only candidate that reads as a chart at 48 px and holds at 16 px. One huge `D` (A) is a letter with an underline; three rows (C) smear at 16 and 24 px |
| Color | one `currentColor` fill, no red or green rule | bb masks SVG icons with the text color, so a second color would be lost; a PNG with baked warm-white ground cannot adapt to a dark listing |
| Type | Rockwell Bold outlined to paths | Exact match to the social preview; no font dependency in the file |
| Fill of the square | ink 89% across, 91% down, lifted 4 units | Height-bound; width came from the rule and `E S` tracking, which also stops `E S` merging at 16 px |
| Rule | 16 units tall on a multiple of 16 | Lands on one whole pixel at 16 px instead of two half-lit ones |

## Screenshot decisions

- Lead with the surface a user gets first: one plain request and the spot
  check reply with its configuration string and two nudges (thread on
  Codex, `codex/gpt-5.6-sol/low`, plugin tier installed).
- Second, the hidden critic child: the fixed prompt, the attached screenshot,
  the critique. bb's web UI cannot render a host-path attachment, so this
  thread was re-run with the PNG uploaded as a project attachment; prompt,
  provider and model identical to the script-spawned child.
- Third, the plugin's page in bb's Extensions catalog with the skill
  capability.
- Sidebar collapsed on the thread shots (unrelated project names); the local
  install path on the plugin page is blurred. No emails, tokens or home
  paths anywhere.
- Not captured: the desktop app's own window chrome, which needs the owner's
  accessibility permission to automate.

## Marketplace rules checked

Icon: square, SVG, single color, under 256 KB, content-hash filename.
Screenshots: PNG, at least 1200 px wide, at or below 2 MiB, real content,
no splash or logo, at most six. Overview: `PLUGIN_OVERVIEW.md` at the repo
root, under 4000 characters, `##` headings only.

## Spot log

| Date | Surface | Configuration | Pair verdict | Rules passed | Top nudge | Applied? | Screenshot |
|---|---|---|---|---|---|---|---|
| 2026-09-22 | icon | owner review | n/a (first version) | n/a | Fill the square; the first cut used 70% of the width | yes | `marketplace/icon/contact-sheet.png` |
| 2026-09-22 | lead screenshot | owner review | n/a | n/a | The visible user prompt carried test-rig wording; re-run with a plain request | yes | `marketplace/screenshots/01-spot-check-thread.png` |
