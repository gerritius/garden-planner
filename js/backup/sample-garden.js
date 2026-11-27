// Test site only: replace the test garden with a made-up one — beds and bags in two areas, crops at every stage from
// just sown to past their best, seedlings in trays, a soil reading or two — so the screens have something to show.

import { S, save } from '../core/state.js';
import { confirmBox } from '../core/ui.js';
import { addDays, go, todayStr, uid } from '../core/util.js';
import { Draw } from '../draw.js';
import { syncTasks } from '../garden/tasks.js';
import { harvestEstimate } from '../plants/growth.js';
import { crop } from '../plants/crops.js';
import { syncStartTasks } from '../plants/seedlings.js';

// [name, width, length] for beds; [name, diameter] for bags
const BEDS = [['Bed 1', 100, 300, 'full'], ['Bed 2', 100, 300, 'full'], ['Bed 3', 120, 400, 'part'], ['Bed 4', 120, 400, 'full'], ['Bed 5', 90, 240, 'shade'], ['Bed 6', 90, 240, 'full']];
const BAGS = 10;
// [where, crop, days since sowing (negative: planned), share of the bed (from, to as fractions)]
const CROPS = [
  ['Bed 1', 'daikon', 70, 0, 1],                  // past its harvest date: ready / going over
  ['Bed 2', 'cabbage', 50, 0, 0.5], ['Bed 2', 'spinach', 6, 0.5, 1],   // half grown + just coming up
  ['Bed 3', 'naganegi', 100, 0, 0.6], ['Bed 3', 'carrot', 20, 0.6, 1],
  ['Bed 4', 'broccoli', 72, 0, 0.5], ['Bed 4', 'komatsuna', 36, 0.5, 1],   // nearly ready + ready
  ['Bed 5', 'garlic', 40, 0, 1],
  // Bed 6 stays empty
  ['Bag 1', 'celery', 12], ['Bag 2', 'lettuce', 30], ['Bag 3', 'garlic', 50], ['Bag 4', 'potato', 90], ['Bag 5', 'potato', 92],
  ['Bag 6', 'snappea', 25], ['Bag 7', 'mizuna', 3], ['Bag 8', 'kale', 58],
  // Bag 9 and 10 stay empty; one planned sowing next week
  ['Bag 9', 'leaflettuce', -7],
];
// seedlings: [crop, days since sowing, cells, tray]
const STARTS = [['broccoli', 3, 12, 1], ['lettuce', 16, 18, 1], ['cabbage', 32, 8, 2], ['kale', 24, 6, 2]];

export async function fillSampleGarden() {
  if (!await confirmBox('Replace the test garden with a made-up one? You get beds and bags with crops at every stage, plus seedlings in trays. Your real garden isn’t touched.', 'Replace', true)) return;
  const td = todayStr();
  const farm = { id: 'a_' + uid(), name: 'Farm' }, yard = { id: 'a_' + uid(), name: 'Backyard' };
  S.areas = [farm, yard];
  S.containers = BEDS.map(([name, width, length, sun]) => ({ id: uid(), type: 'bed', name, width, length, margin: 10, history: [], sun, area: farm.id, notes: '' }))
    .concat(Array.from({ length: BAGS }, (_, i) => ({ id: uid(), type: 'round', name: `Bag ${i + 1}`, diameter: 40, depth: 35, margin: 2, history: [], sun: 'full', area: yard.id, notes: '' })));
  S.plantings = []; S.tasks = []; S.starts = []; S.log = [];
  const byName = n => S.containers.find(c => c.name === n);
  for (const [where, cropId, ago, f0 = 0, f1 = 1] of CROPS) {
    const c = byName(where), k = crop(cropId), { L } = Draw.dims(c);
    const p = { id: uid(), containerId: c.id, cropId, method: k.method === 'plant' ? 'plant' : 'seed', layout: 'rows', from: Math.round(L * f0), to: Math.round(L * f1),
      rowSp: k.rowSp || 30, plantSp: k.thinSp || k.sowSp || 20, sowDate: addDays(td, -ago), status: ago < 0 ? 'planned' : 'active', photos: {}, series: [], harvests: [], fert: [] };
    if (c.type !== 'bed') { p.layout = 'free'; p.positions = Draw.layout(c, Object.assign({}, p, { layout: 'rows' })).pts; }
    if (k.daysHarvest) p.harvestDate = harvestEstimate(p);
    S.plantings.push(p);
  }
  // a first picking from the daikon, a pH reading and some lime on Bed 1, a meter reading saying Bag 2 is dry
  const dk = S.plantings.find(p => p.cropId === 'daikon');
  dk.harvests.push({ id: uid(), date: addDays(td, -2), count: 4, note: '' });
  byName('Bed 1').soil = [{ id: uid(), date: addDays(td, -30), from: 0, to: 300, ph: 6.3, temp: null, salt: '', moistLvl: '', note: '' }];
  byName('Bag 2').soil = [{ id: uid(), date: td, from: 0, to: 40, ph: null, temp: null, salt: '', moistLvl: 'DRY', note: '' }];
  S.log.push({ id: uid(), date: addDays(td, -40), kind: 'soil', product: 'Garden lime', amount: 300, unit: 'g', text: '', cids: [byName('Bed 1').id], pids: [] });
  for (const [cropId, ago, count, tray] of STARTS) {
    S.starts.push({ id: uid(), status: 'growing', created: new Date().toISOString(), events: [], cropId, variety: '', kind: 'tray', nid: 'nt_tray', tray, count, seeds: count * 2, per: null, sowDate: addDays(td, -ago), notes: '' });
  }
  for (const p of S.plantings) syncTasks(p);
  for (const s of S.starts) syncStartTasks(s);
  S.water = Object.assign({}, S.water, { lastDone: addDays(td, -1) });   // the pots were watered yesterday
  S.firstRun = false;
  await save(); go('#/');
}
