# Marketplace screenshots

Captured from the live bb web UI (desktop app 0.42.0) at `127.0.0.1:38886`,
headless Chrome 153 driven over CDP. Viewport 1440 CSS px wide, device scale
factor 2, so every PNG is 2880 px wide. Dark theme, left sidebar collapsed on
the two thread shots so unrelated project names stay out of frame.

- `01-spot-check-thread.png` (2880x1640) — the surface a user gets first: one
  plain request, the skill's spot check on `codex/gpt-5.6-sol/low`, and the two
  nudges it returns. Thread `thr_96jr7s5gz7`, plugin installed.
- `02-critic-child-thread.png` (2880x2000) — the hidden critic child
  (`child` badge): the critic prompt, the attached screenshot, the critique.
  Thread `thr_hdq6wiu4dx`, same prompt and model as the script-spawned child
  `thr_xeadpzczf2`, re-run with the PNG uploaded as a bb project attachment —
  the web UI cannot render host-path attachments, so the script's own child
  showed a broken thumbnail.
- `03-plugin-detail.png` (2880x1520) — the plugin in bb's Extensions catalog:
  name, icon, description, release, and the `design-director` skill capability.
  The local install path under the title is Gaussian-blurred.

Not captured: bb's desktop-app chrome (window capture needs the user's
accessibility permission). The critic's screenshot renders only as a
thumbnail; bb has no larger inline view.
