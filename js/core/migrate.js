// The saved garden's format: checking stored or restored data, and bringing older saves up to date.
//
// Every change to what the app saves (a field renamed, a list reorganised…) gets a step below:
//   1. while the app still writes the old format, save a backup made by it for the tests: npm run fixture
//   2. bump DATA_VERSION and add the step (it must be safe to run more than once)
//   3. npm test — tests/scenarios/old-backups.js restores every saved backup and checks nothing is lost
// Saves from before data versions existed have no dataVersion: they run every step.

import { migrateCareJobTimes } from '../feeding/plans.js';
import { migrateCovers } from '../plants/covers.js';
import { migrateGermChecks } from '../plants/germination.js';
import { migrateHarvestDates, migrateThinningText } from '../plants/growth.js';
import { migrateSeeds } from '../plants/seeds.js';
import { migrateNursery } from '../plants/seedlings.js';
import { migrateFeed, migrateOwnProducts, migrateProducts } from '../products/library.js';
import { blank, S, setState } from './state.js';

export const DATA_VERSION = 9;
const STEPS = [
  { to: 2, what: 'harvest dates typed in by hand stay as they are', run: migrateHarvestDates },
  { to: 3, what: 'cover names: fleece and cloche → fushokufu, bird net → insect net', run: migrateCovers },
  { to: 4, what: 'chemical fertiliser 8-8-8 joins the ticked products', run: migrateFeed },
  { to: 5, what: 'liquid feeds written with their N-P-K become your own products', run: migrateOwnProducts },
  { to: 6, what: 'all products become one editable library', run: migrateProducts },
  { to: 7, what: 'your varieties and packet photos become a seed library; thinning advice in English; care jobs timed by growth', run: () => { migrateSeeds(); migrateThinningText(); migrateCareJobTimes(); } },
  { to: 8, what: 'germination: looks every few days with roughly how many are up, instead of one answer', run: migrateGermChecks },
  { to: 9, what: 'seedlings: a list of your tray and pot sizes instead of one of each', run: migrateNursery },
];

const LISTS = { containers: 'beds and pots', plantings: 'plantings', tasks: 'jobs', log: 'log entries', customCrops: 'own crops', starts: 'seedling trays', products: 'products', seeds: 'seeds' };
// What would stop the app from working with this data, in plain words ('' when it's fine). Deliberately only the things
// that really break it: anything else the app copes with, and refusing good data would be worse.
export function dataProblem(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'it isn’t a garden at all';
  for (const [k, name] of Object.entries(LISTS)) {
    if (d[k] == null) continue;
    if (!Array.isArray(d[k])) return `its ${name} aren’t a list`;
    if (d[k].some(x => !x || typeof x !== 'object')) return `some of its ${name} are damaged`;
  }
  if (+d.dataVersion > DATA_VERSION) return `it was saved by a newer version of the app (data format ${d.dataVersion}; this version reads up to ${DATA_VERSION}) — reload to get the newest version`;
  return '';
}

export class DataError extends Error {}
// Stored or restored data → a garden this version can use: checked, missing parts filled in, older formats brought
// up to date. Works on a copy and leaves S as it was. Throws a DataError, saying why, if the data can't be used.
export function upgrade(raw) {
  const why = dataProblem(raw); if (why) throw new DataError(why);
  const d = Object.assign(blank(), JSON.parse(JSON.stringify(raw))), from = +d.dataVersion || 1, prev = S;
  setState(d);
  try { for (const s of STEPS) if (s.to > from) s.run(); d.dataVersion = DATA_VERSION; }
  catch (e) { throw new DataError(`bringing it up to date didn’t work (${e.message})`); }
  finally { setState(prev); }
  return { state: d, from };
}
