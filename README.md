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
| `js/garden/` | Beds and pots, the map, jobs, watering, soil readings, rotation, season planning, "what could go here?" |
| `js/climate/` | Climate from your location, sowing windows, weather forecast and alerts |
| `js/feeding/` | Nutrients, the feeding card, the day-by-day food model, side-dressing stages, feeding plans, potting mix |
| `js/products/` | Your product library, product pages, sprays and their legal use |
| `js/records/` | The log, past crops, season review and totals, notes and photo timelines |
| `js/backup/` | Snapshots on the phone, export/restore, Google Drive backup |
| `js/pages/` | The main pages: home, calendar, bed/pot, planting form, planting, search, Tools |

A few conventions:

- **The garden is `S`** (`js/core/state.js`). Change it, then call `save()`. To replace it wholesale (restore), use `setState()`.
- **Pages** are functions that return `{ html, after }`; `render()` in `js/core/router.js` picks one from the address (`#/…`).
- **Buttons** carry `data-act="name"`; the page sets `A.name = el => …` while it draws (`A` is cleared on every page).
- **Every name is defined once.** If something needs to behave differently, change it where it's defined.

## Releasing a change

1. Bump `APP_VERSION` in `js/version.js` and `CACHE` in `sw.js` (phones then fetch the new files).
2. A new module goes in the `ASSETS` list in `sw.js` (the `offline-files` test fails if one is missing).
3. `npm run lint` and `npm test` — both also run on GitHub for every push. See [tests/README.md](tests/README.md).
