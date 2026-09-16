# Discover: explore the space of possibilities

The hardest moment in design is the blank screen with infinite possibilities.
The answer is to go broad before going deep, and a model is an excellent tool
for going broad — once it has been pushed out of its comfort zone. Left alone
it makes conservative choices and returns to familiar patterns. Everything in
this stage is about coaxing the opposite: bold, varied, risky.

## Technique 1: seed strings

### Why asking for variety fails

Three versions of the same prompt, and what happens to each:

**"Build me a landing page for my productivity app."**
Run four times, this gives four near-identical pages: purplish gradient, text
on the left, graphic on the right, same section order. Nothing asked for
variety, so the model gave its highest-probability page.

**"...Give me something totally unique. Make every design decision completely
at random."**
Different from the first, but the four runs are still not different from each
other. Same color scheme, same structure, even the same awkward metaphor
(pottery, the article notes). The model is predicting tokens that *sound*
random. It cannot act randomly, because acting randomly means picking an
improbable token, and it is built to pick the probable one.

**The seed-string version** (below).
Four runs, four different palettes, fonts, structures, and ideas. Every run is
one-of-a-kind because the variety was brought in from outside the model. This
is String Seed of Thought, published by Sakana AI.

### The procedure

Run `scripts/seed.sh` (64 characters by default; pass a length to change it).
Then follow this, which is the article's prompt reshaped as instructions to
yourself:

```
1. Generate a long, random alphanumeric string using a shell script.
2. Define the creative direction (color scheme, layout, typography, etc.)
   based on the string. Look beyond the surface for subpatterns, special
   numbers, anything that inspires you.
3. Use your judgment to bring this direction to life and make it look great.
4. Don't reveal the string in the design. It's only for your inspiration.
```

Step 3 matters as much as step 1. The seed picks a region of design space;
taste still has to make the result good. A seed that suggests "acid green and
brutalist grid" is a starting point, not an excuse for an ugly page.

### Reading a seed

There is no correct way to read a string, and that is fine: the goal is a
different starting point per run, not a decoding. A scheme that works, offered
as suggestion rather than rule:

| Seed feature | One way to read it |
|---|---|
| A run that looks like hex (`3fa9c2`) | A palette hue. Take it literally as a color and build from it |
| Repeated characters (`kkk`, `77`) | Rhythm. Tight repetition → dense grid; sparse → generous spacing |
| Digit sums, digit ratios | A type scale ratio, a column count, a border radius |
| Letter clusters that almost spell something (`brnt`, `velv`) | A texture or motif: burnt, velvet, fog, chrome |
| Uppercase vs lowercase balance | Formality. Mostly caps → institutional; mostly lower → casual |
| Position of the first digit | Where the visual weight sits on the page |

Write the reading into the design record so the direction can be explained
later. Two readings of the same seed are both valid; pick the one that
excites you and move on.

## Technique 2: ambitious briefs

The other way to push the model off its defaults is to give it a strong,
specific vision to make decisions against, instead of letting it make them up
on the fly. The ingredient here is the user's taste: an inspiration they
already have — a video game, an interior trend, an art installation — and a
description of how it should shape the result.

From the article:

- "Build me a landing page for my productivity app, with a bold pixel art
  theme and stunning graphics. Each section should feel like a still from a
  video game, yet somehow it should all function as a landing page."
- "Build me a landing page for my productivity app, set in an isometric
  living 3D city, where different features are somehow represented by
  neighborhoods or buildings."
- "Build me a landing page for my productivity app, with a radically
  asymmetric layout, dissonant colors and typography, and uncomfortable
  negative space. Break all the rules but still make it look good."

In the same spirit, across other surfaces:

- "Design the analytics dashboard as a ship's bridge: instruments, not cards.
  Every metric is a gauge or a readout with a physical feel, and the layout
  is dictated by what the operator needs to glance at first."
- "The admin tool is a 1980s airline ticketing terminal: monospaced, dense,
  green-on-black, keyboard-first, with the rare use of amber for anything that
  needs attention. Make density feel calm rather than cluttered."
- "The mobile onboarding is a paper field guide. Each step is a page with a
  hand-drawn illustration, a caption, and one action. Nothing animates except
  the page turn."
- "The settings screen is a hi-fi amplifier faceplate: brushed metal,
  physical toggles, engraved labels. Consistent components; no cartoon
  skeuomorphism."
- "The empty state of the project list is a museum wall with nothing hung on
  it yet. Wall text, a plaque, a single hook. The first project fills the
  frame."

If a brief makes you think "there is no way this works", it is worth one
attempt. Agents surprise people constantly. When it fails, discard the render,
keep the prompt in the record's rejected table with the model and date, and
retry when a newer model ships.

### The ideation ladder

Asking an AI for ideas directly yields the ideas everyone else gets. The fix
is to use the model for breadth and the user for direction.

**1. Ask for many ideas with deliberately little detail.**

```
I want to come up with a bold, unique design language for my product. Can you
list as many ideas as you can, with short, high-level descriptions? Go broad,
not deep.
```

Twenty to forty one-liners. The point is to spark the user's imagination, not
to be right.

**2. Render the favorites and collect reactions, then sharpen.** Quick
throwaway renders of the two or three the user picks, screenshotted. Then ask
what they feel about each. The article's example, on "Industrial Control
Panel":

```
I'm imagining something tactile. Clicky, satisfying buttons, nice sounds.

Initially I pictured something cartoony or skeuomorphic, but this feels tacky
to me. Avoid that.

Instead, want consistent components and little touches that land this look
without going overboard.

Gray gradients would look boring. Need more texture. Maybe we can incorporate
some color, while retaining the control panel feel?

Can you sharpen this one based on my tastes?
```

That message is what makes the result unique. It contains judgments no model
would have made on the user's behalf.

**3. Iterate until it feels right, then write the build prompt.**

```
Can you write a concise prompt that an AI agent could use to build an initial
POC page with this?
```

The output of the ladder is a brief the user co-authored, which is the only
kind that produces a design only they could have made.

## Presenting directions

Discover runs under **Redesign** only; a Review keeps the direction the
surface already has. Produce at least three seeded directions. For each: a
quick build, a screenshot at a realistic viewport, a one-line aesthetic
statement, and one Review critic round (three `opus` repeats, median and
rules tally logged). Lay the screenshots out side by side (a grid image, a
small artboard canvas, or three files sent together) with their medians and
ask which to pursue. Include one direction that seemed too risky; it is often
the one chosen. The score informs the choice; the user makes it.

If the design has inspiration, the reference brief
(`references/reference-brief.md`) is written before the first direction is
built, and every direction is built toward its translation.

Never present a direction as a paragraph of description. People cannot react
to "a warm, editorial layout with generous whitespace"; they can react to a
picture of one.

After the user chooses, record all three in the design record's directions
table, mark the winner, and write down why in the user's words. The losers are
not waste; they are the evidence behind the decision, and one of them may be
the right answer for the next surface.
