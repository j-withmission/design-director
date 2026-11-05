# Reference brief: detect fixture (warn)

Source: fixture · palette: images · model: none · date: 2026-11-04 · hash: fixture

Translation:
- Palette → paper #f6f4ef background, ink #111111 text, rust #c65a2e for one accent only.
- Composition → a single reading column.

Rules:
1. No accent color anywhere; the page is paper and ink only.
   machine: accent-colors <= 0
2. Nothing set below 40px.
   machine: min-text >= 40px
3. The page reads like a printed field guide, not a product site.
   machine: none
