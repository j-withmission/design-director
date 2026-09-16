# Deliver: polish the design into something people will use

AI can build striking visuals. Whether the design makes sense, flows, and does
its practical job is a matter of judgment, and most of that judgment in this
stage is about removing things. Read this once the design has an identity the
critic scores well, and again right before anything is shown for sign-off.

## Technique 6: cut what doesn't add value

AI loves to add and rarely takes away. The biggest sign that a design is
machine-made is that it overexplains everything and carries elements with no
practical purpose. Restraint immediately reads as premium and tasteful, so the
polishing effort goes mostly into deletion.

### The worked example

The article's calorie tracker. The brief asked for a "clean, minimalist
design" and got something impressive for being fully generated, and still
carrying:

- Pink glowy effects in the background and on the progress bar
- Random colors and highlights on text
- Extra labels and empty space when displaying all the foods for a day, when
  the images already communicate this
- Custom buttons and text fields that look worse than built-in iOS components

The instruction that fixed it:

- Simplify the layout into an image-centric grid
- Get rid of gradients, glows, and unnecessary containers
- Aim for a truly minimalist aesthetic that feels Apple-native

The result was opinionated. The visuals spoke for themselves, native iOS
components replaced the custom ones, the excess color and gradients were
gone, and the text got smaller, simpler, tighter. That is good design, and no
current model makes those choices unprompted: stripping a design down means
deleting code and taking a risk, and the model is trained to be safe. The push
has to come from this pass.

### The subtraction procedure

Walk the screen element by element, top to bottom, and for each one ask:
**what breaks if this is removed?**

| If the answer is... | Then |
|---|---|
| "Nothing" | Remove it |
| "The user loses information they need" | Keep it, but check whether something else already conveys it |
| "It looks emptier" | Remove it anyway, then fix the composition with spacing, not with a new element |
| "The user can't complete the task" | Keep it |

Usual casualties, in rough order of how often they should go:

- Background glows, gradient washes, decorative orbs
- Labels that repeat what an image, icon, or position already says
- Containers, cards, and borders around single items
- Subheads under headlines that restate the headline
- Section eyebrows ("FEATURES", "HOW IT WORKS") above headlines that don't
  need them
- Decorative dividers
- Badges and pills carrying no state
- A second and third call to action per view
- Accent color on words that aren't actions or state

After each cut, re-screenshot. The composition usually needs a spacing
adjustment, not a replacement.

### Native components

Custom controls that look worse than the platform's are a downgrade dressed
as effort. Use the platform's buttons, fields, switches, pickers, and sheets
on iOS and Android; use the project's design system on the web if there is
one. Custom is justified when the direction genuinely calls for it (the
control-panel toggle in a control-panel design) and the custom version is
executed at least as well as the native one.

## Technique 7: remove AI tells

*The source article is truncated at this section. The checklist below is
reconstructed from its earlier examples and from the patterns critics flag
most consistently.*

A tell is any pattern common enough in generated pages that a viewer's eye
reads "AI" before it reads anything else. One is survivable; three together
are a verdict. Walk the list against the screenshot, not the code.

**Layout**

- Hero with text on the left, graphic on the right, button under the text
- Three-column feature grid: icon, title, two-line blurb, repeated
- Everything in a card, cards in a grid, grid in a container
- Perfect symmetry everywhere; nothing breaks the column
- The template order: nav, hero, logos, features, testimonials, pricing, CTA
  band, footer
- Sections that each have eyebrow + headline + subhead + content, identically

**Color**

- Purple, indigo, or violet gradients, especially on the hero and on buttons
- Glow effects behind objects or under cards
- Random accent highlights on words in a headline
- Gradient text
- A "primary" color that never appears in the product itself

**Type**

- Inter, or the default sans, for everything
- Oversized hero headline over a gray subhead, with no other size in between
- Title Case On Every Heading And Button
- Identical weight everywhere; hierarchy carried by size alone

**Copy**

- Overexplaining: a caption for every image, a sentence for every icon
- "Seamlessly", "Effortlessly", "Unlock", "Elevate", "Supercharge",
  "Empower", "Streamline", "Next-level"
- Triple adjectives ("fast, simple, and powerful")
- Headlines that describe the category instead of the product
- Placeholder testimonials with alliterative names

**Imagery**

- Abstract blobs, gradient orbs, blurred circles behind content
- Emoji as icons
- Stock 3D shapes (floating spheres, torus knots, glass cubes) meaning nothing
- No real image anywhere on a page about a real thing
- Dashboard mockups inside the dashboard

**Components**

- Custom buttons and inputs worse than native
- Containers around things that didn't need containing
- Decorative dividers between sections that spacing would separate
- Badges, pills, and tags with no state behind them
- "New" and "Beta" labels on everything

**Motion**

- Fade-up-on-scroll on every element
- Hover-lift-and-shadow on every card
- Gradient shimmer on buttons
- Anything that moves without communicating state or affordance

Fixing a tell means removing or replacing it, not decorating around it. A
purple gradient with a noise overlay is still a purple gradient.

## The states pass

Empty, loading, error, partial, and "nothing to do here" are screens people
see, sometimes more often than the happy path. Under **Review**, build and
screenshot only the states the task introduces or changes, and name the rest
as unstyled in the final message. Under **Redesign**, each gets designed in
the same direction as the rest, built, and screenshotted:

| State | What it needs |
|---|---|
| Empty | The direction's voice, one clear next action, no sad illustration |
| Loading | A skeleton or progress shaped like the content it precedes; no spinner in a void |
| Error | What happened, what to do, in the product's tone; no red wall |
| Partial | Real data next to missing data without the missing part looking broken |
| Nothing to do | A calm screen that says so; this is a success state, not an empty one |

An unstyled state is an unfinished screen. Say so rather than reporting the
surface complete.

## Pre-sign-off checklist

Run this before showing the user, and show them the screenshots, not this
list.

- Subtraction pass done; the design record lists what was cut
- Every tell in the checklist above checked against the current screenshot
- Native components wherever custom ones weren't earning their place
- States in scope built and screenshotted; out-of-scope states named as
  unstyled
- Redesign runs only: long-text, narrow-viewport, and dark-mode variants looked
  at where they apply
- Charts went through `dataviz`; artifacts went through `artifact-design`
- Lighthouse run on every web surface: accessibility at 90 or above, the
  other three scores logged in the record, heavy media dealt with
- The critic's last score and top gaps are in the record
- Screenshots of every touched surface are in front of the user, and the
  user has judged them, before any PR is opened
- Design decisions written to `docs/design/` in a repo that keeps records; no
  design status tracked on the PR itself
