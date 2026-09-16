# Generated media: images, texture, and motion

Coding agents love to write code, so when a design needs an image they reach
for the code-shaped substitutes: gradients, shapes, blurred blobs, CSS
patterns. Those are among the strongest giveaways of an AI-generated page,
because they demonstrate exactly surface-level effort. A real image, a baked
texture, or a physically plausible animation demonstrates more than that, and
the difference is visible at a glance.

Some agents have image tools built in and underuse them. Others don't, but can
call an image or video API given a key. Read this when the critic flags flat or
fake-rich visuals, when the direction obviously wants imagery or motion, or
when a page has nothing on it but type and boxes.

## Keys

Look for `.env.agents` in the repo root. It is gitignored and holds keys that
exist for the agent's use during development only:

```
OPENAI_API_KEY=...     # image generation
GEMINI_API_KEY=...     # image generation
FAL_KEY=...            # fal.ai: video generation, matting, many image models
```

If the file exists, source it in the shell for the generation calls and use
the keys locally. They never go into product code, committed config, or the
built output.

If it does not exist, say so in one line and continue with the fallbacks at
the bottom of this file. Don't stall, and don't ask the user to paste a key
into the conversation. If the user wants to set one up, the article's
instruction is the right shape:

> Create a gitignored file called `.env.agents`, store the API key in it, and
> note in `AGENTS.md`/`CLAUDE.md` that these keys are for the agent to use
> during development but must not ship with the product.

Advise a separate key with a tight spend limit, created just for the agent, so
a leak or a runaway loop is bounded and the key can be revoked without
disrupting anything else.

Other routes the article lists, for when they apply:

- **Codex, Antigravity, Grok Build**: built-in image generation exists; it is
  rarely used until asked for.
- **Claude Code plus a ChatGPT subscription**: "Use the Codex CLI to generate
  images. Help me install it if it isn't already present. Make sure it's
  billing my subscription, not an API key."

## Technique 4: image generation

The prompt that started the article's examples:

```
The design is pretty plain. Add more personality using image generation.
Consider shaders or 3D effects in combination with images to create more
interesting visuals.

Verify that your work looks right frame-by-frame in the browser.
```

### When to reach for it

- A hero, empty state, or section that currently holds a gradient, an orb, or
  an abstract shape standing in for content
- A direction built around a material or world (paper, brass, a city, a
  workshop) that CSS cannot convincingly render
- Icons or illustrations that are currently emoji or stock geometry
- Texture for a whole surface: grain, fiber, weave, patina

### Prompts that produce assets that integrate

Generated images look pasted on when they ignore the page around them. Ask
for:

- A **solid or transparent background** in the page's actual background color,
  so the edge disappears
- The design's **palette by name and hex**, and the dominant hue's temperature
- A **consistent light direction** across every asset on the page (state it:
  "lit from upper left, soft")
- The **camera and scale** matching the layout: "three-quarter view, object
  fills 70% of frame" for a hero, "flat, top-down, centered" for an icon
- **Style constraints** drawn from the direction: "editorial photograph,
  35mm, shallow depth", "flat risograph print, two inks, visible misregistration"
- Nothing the page will also render: no text in the image, no UI chrome

Generate two or three variants, drop them into the page, and screenshot.
Choose from the render, not from the raw images.

### Shaders and 3D on top of images

An image plus a light effect reads as far richer than either alone: a
WebGL/CSS displacement over a still, a subtle parallax between two layers, a
specular sweep on a product shot. Keep the effect physically plausible and
slow. Verify frame by frame in the browser; the failure mode is a shimmer that
looks like a bug.

## Technique 5: video generation

Video models are underused for design because people think of them as ad and
clip generators. Two uses that transform product surfaces:

### Animated graphics with the background removed

Generate a looping clip on a solid background, then remove the background —
chroma key for simple cases, a video matting model for anything with soft
edges, glass, or motion blur. The result is an animation that can be layered
anywhere in the UI without reading as "a video".

The article's crystal example, near verbatim:

```
Replace the image on this page with a looping video clip that does something
more interesting. Have the crystal splinter apart and slowly spin around. It
should have awesome glassy effects that refract the page background and cast
shadows and light around it.

To get convincing glass refraction effects, render the video of the glass over
the page background colors first (so it bakes in the refraction effects), then
remove the background with a video matting model.

Find appropriate recent models for video generation and background removal.
```

The bake-then-matte trick is the important part. Refraction and caustics only
look right if the video model saw the real background; you then matte the
object out and place it back over the live page, and the baked-in refraction
reads as physically correct.

### Fluid transitions between states

Many video models interpolate between keyframe images. Two product stills
become a transition clip. Play it on an action (navigating between screens),
or scrub it frame by frame against a gesture (scroll, swipe). The article's
one-prompt suitcase demo:

```
Build a demo page for a suitcase that uses a video model to create interactive
transitions between a couple of screens. Each screen should show the suitcase
in a different state, with vertical motion that feels appropriate for
scrolling:

- Initially, have the suitcase floating high up in the air
- Then have it land on the floor and pop open
- Finally, have its contents neatly land into it from the top

Generate the initial frame using image generation. Then generate a video clip
that starts from that frame and animates to the next state. Use the final
frame of that video to seed the next transition so that it continues
seamlessly. Scrub through the transitions one by one as the user scrolls.

Use a video model with strong physics and consistency.
```

Seeding each clip from the previous clip's final frame is what makes the
sequence continuous. Extract that frame, pass it as the start keyframe of the
next generation, and the object never jumps.

### Choosing models

Use an aggregator such as fal.ai so one key covers many models, and let the
run evaluate the current options rather than hardcoding a name; the best video
model changes every few months. Prefer models known for physics and temporal
consistency for anything the user will scrub, and prefer a dedicated matting
model over chroma key for glass, hair, smoke, or motion blur.

Keep clips short (two to six seconds), loop-friendly where they loop (matching
first and last frames), and encoded for the web with a poster frame so the
page never shows a black rectangle while loading.

## Fallbacks when no key is available

These are real design moves, not consolation prizes:

- **SVG illustration** drawn for the direction: line art, isometric, cut-paper.
  Consistent stroke, consistent palette, one light source.
- **CSS-only texture**: an SVG `feTurbulence` grain overlay at low opacity, a
  fine dot or line pattern, a paper-fiber noise. Texture is the cheapest thing
  that separates "designed" from "generated".
- **Real photography the user supplies**: ask for it once, early, and lay out
  around placeholders of the right aspect ratio until it arrives.
- **Typographic imagery**: an oversized numeral, a single glyph, a word set as
  the graphic. Restraint reads as confidence.

What is not a fallback: gradient orbs, blurred blobs, glow effects, and
abstract geometric shapes floating behind text. Those are the tells this stage
exists to remove; using them as stand-ins makes the page worse than leaving
the space empty.

Record every generated asset in the design record with provider, model, and
prompt summary so it can be regenerated when the palette changes.
