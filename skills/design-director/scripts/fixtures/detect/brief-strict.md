# Reference brief: detect fixture (strict)

Source: fixture · palette: images · model: none · date: 2026-11-04 · hash: fixture

Resolution:
- Palette: one paper, one ink, one rust accent, nothing else.

Translation:
- Palette → paper #f6f4ef background, ink #111111 text, rust #c65a2e for one accent only.
- Composition → a single reading column; the hero is type, not a picture.
- Focus → a serif headline well above the body size; sans body.
- Density → loose; gaps vary with the content.
- Light and material → flat printed paper: no gradients, no shadows, square corners, hairline rules.

Rules:
1. One accent color at most, and it is the rust.
   machine: accent-colors <= 1
2. Every color on the page is paper, ink or rust.
   machine: palette-only
3. Headlines are set in a serif, body text in a sans.
   machine: families == {serif:display, sans:body}
4. Surfaces are flat: no gradient fills anywhere.
   machine: no gradients
5. Nothing floats: no drop shadows.
   machine: no shadows
6. Corners are square or nearly so.
   machine: radius <= 4px
7. Rules and borders are hairlines.
   machine: border-weight <= 1px
8. No text below 14px.
   machine: min-text >= 14px
9. Text meets WCAG AA contrast.
   machine: contrast >= AA
10. The page reads like a printed field guide, not a product site.
   machine: none
