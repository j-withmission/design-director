# The trends scan

Once a month a script collects about thirty new sites from public design
galleries and shoots their homepages, and one vision pass writes a digest of
what they share. The digest is text, committed under `trends/` in the skill
directory (the folder this skill's `SKILL.md` is in); the screenshots never
are. The brief writer and Discover get the digest in full, the critic gets
only its register tells, and the spot check gets nothing.

## Why

A trend digest is a fashion read, not taste. What most pages share this
month is this month's default, and a default is what reads as "AI-made" six
months later: the purple gradient was a trend before it was a tell. So the
digest is as useful as a list of tells to avoid as a list to follow.
On-trend is not a score, and the user decides the register: follow the
month, counter it, or ignore it.

The skill has already met the failure this could repeat. On 2026-10-29 the
owner observed the loop converging on one look, the hairline ledger,
whatever the surface. A digest handed to the critic as a target would do the
same with a different look. It is handed over as a register the user
chooses against, never as a target, and the critic's register line never
touches the score.

## What runs monthly

1. **The scan.** `scripts/trends.sh <out-dir> [count]` (count default 30).
   It reads the listing URLs from `trends/sources.md`, fetches each listing
   once with a browser user agent, takes the outbound site links, and drops
   every host a previous run already shot (`trends/*/manifest.tsv` and
   `trends/seen.txt`), so each month's set is new sites. It takes hosts
   round-robin across the galleries so no one gallery sets the month,
   passes over a host whose robots.txt refuses `*` or an Anthropic agent or
   that does not answer a plain request, and shoots each homepage at
   1280×1200 with `scripts/shot.sh` (Playwright's Chromium through `npx`
   when there is no Chrome). It writes `<out-dir>/manifest.tsv` (host,
   source, shot file or `failed`), the PNGs to `<out-dir>/shots/`, and the
   shot hosts to `trends/seen.txt`. It exits 0 when at least five shots
   succeeded, 1 when fewer did, 2 on bad usage or an out-dir that already
   has a manifest. A shot under 25 KB is named as a likely intro or loader
   frame; it stays in the set and the prompt tells the writer how to read
   it.
2. **The digest.** One vision pass by an `opus` subagent (fall back to
   `fable`; never `sonnet`, for the same reason the scoring critic is never
   Sonnet: its reads of identical input do not hold still, and a digest is
   compared with last month's). It reads every shot and writes the digest
   with the prompt below. In bb, `scripts/bb-critics.sh --role trends
   --repeats 1` with one `--image` per shot, in manifest order; the
   preamble becomes "The screenshots are attached to this message, in this
   order: [FILE NAMES]. Do not open any files in the workspace."

Cost: about thirty images in one call, roughly 1 to 3 USD a month. One call,
no repeats: a digest is a read, not a score.

## The digest prompt

Open the subagent's instructions with exactly this, then the prompt:

```
Read these image files with the Read tool and nothing else (do not open any
HTML or source files, and do not visit the sites), in this order:
[ABSOLUTE PATHS]

Then respond to the following.
```

Fill `[N]` with the number of shots read and `[SOURCES]` with the distinct
values of the manifest's source column. Fill the `[IF PREVIOUS DIGEST: ...]`
block with the body of `trends/latest.md` when it exists; otherwise delete
the block.

```
You are the design director at a top-tier studio, reading a month's new
sites to say what the web looks like right now. Attached are [N]
screenshots of homepages that public design galleries listed this month,
from [SOURCES]. Each is 1280 pixels wide and shows only the homepage above
the fold, on load: no scrolling, no hover, no motion. A frame that is nearly
one flat colour is usually an intro or a loader; say so where it matters and
do not read it as the page's design.

[IF PREVIOUS DIGEST: Last month's digest, [YYYY-MM], is below. Use it only
to say what is new and what is fading; do not repeat it.

--- Previous digest ---
[PREVIOUS DIGEST TEXT]
--- End of previous digest ---]

Your job is to describe the month's default: what most of these pages
share, precisely enough that a designer can choose to follow it or to work
against it. What most pages share this month is the look that will read as
generic next, so be as exact about the default as about the exceptions.

Rules for the read:
- Describe patterns, not sites. Name a site only to credit a counter-move.
- Do not praise, rank or score any site.
- No brand names beyond naming which site made a counter-move.
- Nothing about the reader's own product or project; you have not seen it
  and it is not the subject.
- Short bullets. Give approximate hex values wherever a colour is named.
  Name type by its kind (grotesk, transitional serif, mono) and its
  treatment (size, weight, tracking, case) when you cannot name the face.
- A pattern is the default when about half the pages or more show it. Say
  "about N of M" when the count matters.
- Register tells are patterns a critic can spot in one screenshot without
  this digest: concrete, visible, one line each.

No preamble, no commentary. Respond in exactly this structure:

Sites read: N, from [SOURCES]
The month's default:
- (three to six bullets: what most of the pages share; this is the look that will read as generic next)
Palette:
- ...
Type:
- ...
Layout:
- ...
Material:
- ...
Motion (as far as a still shows it):
- ...
Copy:
- ...
Counter-moves:
- (what the strongest pages did against the default, with the site named)
New since last digest:
- (only with a previous digest; else "first digest")
Fading:
- (only with a previous digest)
Register tells:
On-trend:
- (five to eight patterns a critic can spot in a screenshot that mark a page as made this season)
Dated:
- (five to eight patterns that mark a page as last season or earlier)
```

## Storing the digest

1. Save the writer's output verbatim as the digest body.
2. Hash the body: `shasum -a 256 <body file> | cut -c1-12`, the same as the
   brief. The hash is what records and configuration strings cite.
3. Write `trends/YYYY-MM.md` as one header line, a blank line, then the
   body:

   ```
   Trends digest YYYY-MM · date: YYYY-MM-DD · model: [model] · sites: [shots read] of [count asked] · sources: [hosts] · manifest: trends/YYYY-MM/manifest.tsv · hash: [12 chars]
   ```

   To check a hash later: `tail -n +3 trends/YYYY-MM.md | shasum -a 256 |
   cut -c1-12`.
4. Copy it to `trends/latest.md`: a copy, not a symlink, so the file
   survives every install route.
5. Commit the digest, `latest.md`, the month's `manifest.tsv` and
   `seen.txt`. Never the `shots/` folder: those are third-party screenshots
   and this repo is public; `.gitignore` excludes `trends/*/shots/`.

## How the digest is used

| Who | Gets | Never gets |
|---|---|---|
| Brief writer | The month's default, Counter-moves and Register tells, in the `[IF TRENDS: ...]` block of `reference-brief.md`, with the register the user chose | The site list, the screenshots |
| Discover, the ideation ladder | The whole digest | The screenshots |
| Scoring critic | Register tells only, in the `[IF TRENDS: ...]` block of `critic-prompt.md`; reports a `Register:` line that never feeds the score | Everything else in the digest, the site list, the screenshots |
| Spot check | Nothing | Everything |

A digest enters a design only by being **pinned**. The register question
pins `trends/latest.md` as it stands, by its dated path and hash
(`trends/YYYY-MM.md`, never `latest.md`), in the record's Trends digest
section. The record keeps that digest until the loop ends: a new month's
digest landing mid-loop does not reset a baseline or change what the critic
reads. The pinned digest's hash is part of the configuration string next to
every score, like the brief hash; pinning a newer digest starts a new
baseline row. Re-pin between loops, never to move a score.

A Review on a surface whose record already pins a digest keeps it. A Review
on a surface with no pin runs without one; the register is the user's
choice, and a Review does not ask it.

## The register question

Under Redesign, when `trends/latest.md` exists in the skill directory, the
gate call carries one more question (`SKILL.md`, Brief check):

- Question: "A trends digest for [YYYY-MM] exists. What register should
  the directions take?"
- Options, in this order:
  1. **Follow it**: build inside the month's default.
  2. **Counter it**: build against the month's default.
  3. **Ignore it**: run as if there were no digest.
  4. **Directions differ**: one direction follows, one counters.

Without an answer, the directions differ. When the digest is more than
three months old, say its month in the question; a stale read is still a
read, but the user should know its age. When `trends/latest.md` does not
exist, ask nothing and say nothing: the scan is optional.

What each answer means for Discover and the record:

- **Follow it.** The digest is pinned. Every direction starts from the
  month's default as vocabulary and varies within it; the seed and the
  divergence check apply unchanged, so three on-trend directions still
  differ on their open axes. The goal register is on-trend.
- **Counter it.** The digest is pinned. Every direction works against the
  default: the default bullets and the On-trend tells are the list to
  avoid, and the Counter-moves are a starting point, not a template. The
  goal register is counter-trend. Counter is not dated: a direction that
  lands on the Dated tells has gone backward, not against.
- **Ignore it.** Nothing is pinned. The brief, Discover and the critic run
  as if no digest existed. The record notes the answer and the digest it
  ignored.
- **Directions differ.** The digest is pinned. One direction follows the
  default, one counters it, and the third is the seed's own, with no
  register asked of it. The directions table names each as follows,
  counters or neither. The user's choice among them decides the register,
  and the record says which.

## Standalone asks

The stage router sends these here without the gate question:

- **"Run the trends scan".** Run it by hand (below). Say the cost in one
  line first.
- **"What's on trend".** Read `trends/latest.md` and give its month, The
  month's default and the Counter-moves. If there is no digest, say so and
  offer the scan.
- **"Is this dated".** Screenshot the surface with `scripts/shot.sh`, then
  one `opus` call with the critic's Read-only preamble, the screenshot, and
  the prompt below filled with the Register tells of `trends/latest.md`. No
  score, no gaps. If the surface has a record, log the line in its Open
  questions with the digest hash; it is not a critic round.

```
You are a design critic at a top-tier studio. You have not seen this design
before. Judge only what is on screen.

A digest of a recent month's new sites lists the patterns that mark a page
as made this season and those that mark it as last season or earlier:

--- Register tells ---
[REGISTER TELLS SECTION]
--- End of register tells ---

Say whether the screenshot reads on-trend, counter-trend (made now,
deliberately against the season's default) or dated, and name the tells you
see as evidence. None of the three is better than the others. No score, no
advice.

Respond in exactly this structure:

Register: on-trend | counter-trend | dated
Evidence:
- ...
```

## The monthly routine

A cloud Claude routine on this repository runs on the first of each month.
It runs the scan, writes the digest as its own writer (it is the `opus`
pass), commits the text on a `trends/YYYY-MM` branch and opens a pull
request. Merging the pull request is how the owner accepts a digest; an
unmerged one is a draft, and nothing reads it. The routine was created on
2026-10-29 (`claude-opus-5-5`, first of the month at 08:00 UTC, no
connectors): https://claude.ai/code/routines/trig_01UPdYJX9R4reJHkja5V8NRc.
It clones the default branch, so the scan has to be merged before it can
run. The routine's prompt, to paste as is:

```
You are running the monthly trends scan for the design-director skill in
this repository. The repository is already cloned and is your working
directory. Do every step in order; if one fails, stop and report what
failed and its output.

1. MONTH is the current month as YYYY-MM: run `date +%Y-%m`. If
   skills/design-director/trends/$MONTH.md already exists on the default
   branch, stop: this month is done.
2. Create the branch: `git checkout -b trends/$MONTH`.
3. Run `skills/design-director/scripts/trends.sh skills/design-director/trends/$MONTH 30`.
   If it has no Chrome it installs Playwright's Chromium through npx; let
   it. It exits 0 when at least five shots succeeded. On any other exit,
   stop and report its output; never write a digest from fewer than five
   shots.
4. Read skills/design-director/references/trends.md, the sections "The
   digest prompt" and "Storing the digest". You are the digest writer: you
   follow that prompt yourself, not a subagent.
5. Read skills/design-director/trends/$MONTH/manifest.tsv. Read every PNG
   in skills/design-director/trends/$MONTH/shots/ with the Read tool, in
   manifest order (rows whose shot column is "failed" have no file). Do not
   visit the sites or open any other file. If
   skills/design-director/trends/latest.md exists, read it: it is the
   previous digest.
6. Write the digest exactly as the prompt specifies. N is the number of
   PNGs you read; SOURCES are the distinct values of the manifest's source
   column. Fill the previous-digest block from latest.md, or leave it out
   when there is none.
7. Save it as "Storing the digest" says: write the body to a temporary
   file, take its hash (`shasum -a 256 <file> | cut -c1-12`), write
   skills/design-director/trends/$MONTH.md as the header line, a blank
   line, then the body, and copy that file to
   skills/design-director/trends/latest.md (a copy, not a symlink). In the
   header, model is the model you are running as.
8. Stage exactly these four paths:
   skills/design-director/trends/$MONTH.md,
   skills/design-director/trends/latest.md,
   skills/design-director/trends/$MONTH/manifest.tsv,
   skills/design-director/trends/seen.txt.
   Run `git status --short` and confirm nothing under a shots/ folder is
   staged; the screenshots are third-party sites and are never committed.
   Commit with the message "Trends digest $MONTH".
9. Push: `git push -u origin trends/$MONTH`.
10. Open a pull request with gh, base the default branch, titled
    "Trends digest $MONTH". The body is the digest's "The month's default"
    section verbatim, then a blank line, then one line: "Sites read: N of
    30 asked, from SOURCES. Failed shots: F. Hash: H." with the numbers
    filled in, then a blank line, then exactly this line:
    🤖 Generated with [Claude Code](https://claude.com/claude-code)
11. Report the pull request URL and the counts.
```

**By hand, locally.** The same steps from a clone of the repository: run
`trends.sh` into `skills/design-director/trends/YYYY-MM`, spawn one `opus`
subagent (else `fable`) with the preamble and the prompt above and the shot
paths from the manifest, save and copy the digest as "Storing the digest"
says, and commit the four text files on a `trends/YYYY-MM` branch for a
pull request. In bb, the digest pass is `scripts/bb-critics.sh --role trends
--repeats 1 --prompt-file <prompt> --out-dir <dir>` with one `--image` per
shot. Delete the `shots/` folder once the digest is merged; nothing reads it
again.

## Limits

- **Homepage only, above the fold, on load.** One still per site. Product
  screens behind a sign-up, inner pages, scroll-driven sections and
  everything below 1200 pixels are not in the read.
- **No motion.** Intros, transitions and scroll effects are where much of
  the month's fashion lives, and a still cannot show them. An intro caught
  mid-play is a loader frame, not a design.
- **The galleries' own selection.** Galleries favour marketing sites,
  studio portfolios and the editorial look; product UI is rare in the set.
  The digest describes what galleries chose to list, not the web at large.
- **One read a month,** by one model, with no repeats. Two digests a month
  apart differ partly because the model read them differently.
- **A digest is evidence about the month, not about the user's product.**
  It says what pages share; it does not say what this surface should be.
  That is the brief's job and the user's.
