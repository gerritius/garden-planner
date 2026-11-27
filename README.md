# Garden Planner

An offline web app for planning beds, pots and grow bags, and for keeping track of sowings, thinning, fertiliser and harvest dates.
All data stays on the phone (IndexedDB); use Settings → Export backup to save a copy to Proton Drive or Google Drive.

Hosted with GitHub Pages: plain static files, no build step.

Fonts: Zilla Slab and Caveat, SIL Open Font License (bundled in fonts/ for offline use).

## How the code is organised

The app is plain JavaScript in ES modules under `js/`, loaded straight by the browser (`index.html` loads `js/main.js`,
which imports the rest). Each module says at the top what it's for, imports what it uses, and exports what other modules
use — so to see where something comes from, look at the `import` lines.

| Folder | What's in it |
|---|---|
| `js/main.js` | Start-up: loads the saved garden, page-wide listeners, draws the first page |
| `js/core/` | The garden state (`S`) and saving, the database, the page router, dialogs, drop-downs, photos, themes, helpers |
| `js/data/` | Built-in data: the crop catalog, product catalogue, pesticide registry, icons |
| `js/plants/` | Crops, how plants develop with temperature (sprouting, thinning, harvest), seedlings, covers, problems, varieties |
| `js/garden/` | Beds and pots, areas, jobs, watering, soil readings, rotation, season planning, "what could go here?" |
| `js/climate/` | Climate from your location, sowing windows, weather forecast and alerts |
| `climate/` | The world climate tiles the app reads its location's usual weather from (made by `tools/era5/build.py` from ERA5; one 5° tile per download) |
| `js/feeding/` | Nutrients, the feeding card, the day-by-day food model, side-dressing stages, feeding plans, potting mix |
| `js/products/` | Your product library, product pages, sprays and their legal use |
| `js/records/` | The log, past crops, season review and totals, notes and photo timelines |
| `js/backup/` | Snapshots on the phone, export/restore, Google Drive backup |
| `js/pages/` | The main pages: home, calendar, bed/pot, planting form, planting, search, Tools |

A few conventions:

- **The garden is `S`** (`js/core/state.js`). Change it, then call `save()`. To replace it wholesale, use `restoreGarden()`
  (`js/backup/backup.js`): it checks the data, brings it up to date and keeps the old garden so it can be undone.
- **Pages** are functions that return `{ html, after }`; `render()` in `js/core/router.js` picks one from the address (`#/…`).
- **Buttons** carry `data-act="name"`; the page sets `A.name = el => …` while it draws (`A` is cleared on every page).
- **Every name is defined once.** If something needs to behave differently, change it where it's defined.

## How a change reaches the phone

1. **Work on the `test` branch.** Every push there is linted and tested, then published to the test site,
   <https://gerritius.github.io/garden-planner/test/> — striped purple header, "TEST SITE" badge. It has its own garden
   (Tools → "Copy my real garden here" starts it from a copy; the real one is never changed), its own offline copy and
   settings, and no Google Drive backup.
2. **Release by merging `test` into `main`.** Before it goes live the version must be raised in three places that a
   test keeps in step: `js/version.js`, `VERSION` in `sw.js`, and `releases.json` (newest first, with notes written for
   the person using the app — the app shows them).
3. **On `main`** the same checks run, the real site is published, and the new version is tagged (`v1.27.0`) with a
   GitHub release carrying the notes. A change to the app without a new version is refused.
4. **On the phone** the app notices the new version (at start, when it comes back to the front, and every few hours),
   offers "Update now", and afterwards shows what's new once.

All of this is in `.github/workflows/deploy.yml`. It needs GitHub Pages set to deploy from Actions (Settings → Pages →
Source: GitHub Actions).

## Data safety

- **The saved format has a version** (`DATA_VERSION` in `js/core/migrate.js`). Older saves are brought up to date when
  they're loaded or restored, step by step; a copy in the old format is kept on the phone first.
- **Changing the format:** while the app still writes the old format, run `npm run fixture` to save a backup made by it
  into `tests/fixtures/backups/`; then raise `DATA_VERSION` and add the step. The `old-backups` test restores every
  backup there (from versions back to 1.3.3) and checks nothing is lost and every page works; it fails if a format change
  has no backup from before it.
- **If the garden can't be loaded**, the recovery screen takes over and nothing is saved over it: keep a copy of what's
  stored, go back to one of the phone's daily copies, restore a backup file, or start again (keeping the old one).
- **Every restore can be undone** (Tools → Backup), and restoring no longer clears photos first.
