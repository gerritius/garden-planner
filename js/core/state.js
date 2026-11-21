// The garden (S): everything the app knows about your beds, pots, plantings, tasks and records, and saving it.

import { DB } from './db.js';
import { todayStr } from './util.js';

export let S = null;
export function setState(v) { S = v; return v; }
export function blank() {
  return { format: 1, containers: [], plantings: [], tasks: [], customCrops: [], customVarieties: {}, log: [], created: todayStr(), lastBackup: null };
}
export function save() { S.lastEdit = todayStr(); return DB.set('state', S).catch(e => alert('Could not save: ' + e)); }
