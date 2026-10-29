# Trend sources

The galleries `scripts/trends.sh` reads once a month for new sites. The owner
may add or remove rows; the script takes the first URL in each table row as
the listing page, so keep one gallery per row.

Each listing page is fetched once a month with a browser user agent, and
robots.txt is respected: a whole-site `Disallow` for `*` or for an Anthropic
agent skips the gallery. Login-gated galleries (Mobbin, Refero, Pageflows)
are out because the script cannot read them.

Checked 2026-10-29: siteinspire.com (429), lapa.ninja, land-book.com and
saaspo.com (403) refuse a scripted fetch, and godly.website disallows
ClaudeBot and anthropic-ai in robots.txt and renders its listing in the
browser, so none of the five is listed. Retry them by adding a row; the
script names a source that yields nothing.

| Gallery | Listing URL | Shows | Extraction |
|---|---|---|---|
| Minimal Gallery | https://minimal.gallery/ | marketing | The listing links out to the sites directly, next to its own detail pages |
| Httpster | https://httpster.net/ | marketing | The listing links out to the sites directly |
| One Page Love | https://onepagelove.com/ | marketing | Mostly internal detail pages; only the sites with a direct visit link are taken |
| Awwwards, Sites of the Day | https://www.awwwards.com/websites/sites_of_the_day/ | marketing | The listing links out to each day's site directly, beside its detail page |
| Dark Mode Design | https://www.darkmodedesign.com/ | both | The listing links out to the sites directly |
