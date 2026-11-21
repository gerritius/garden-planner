// The garden (S): everything the app knows about your beds, pots, plantings, tasks and records, and saving it.

import { DB } from './db.js';
import { todayStr } from './util.js';

export let S = null;
export function setState(v) { S = v; return v; }
export function blank() {
  return { format: 1, containers: [], plantings: [], tasks: [], customCrops: [], customVarieties: {}, log: [], created: todayStr(), lastBackup: null };
}
// Saving is only switched on once the garden has loaded properly (or been restored): if loading failed, what's in
// memory is not your garden, and saving it would write over the real one.
let canSave = false;
export function allowSaving() { canSave = true; }
export const savingAllowed = () => canSave;
export function save() {
  if (!canSave) return Promise.resolve(false);
  S.lastEdit = todayStr();
  return DB.set('state', S).catch(e => alert('Could not save: ' + e));
}
