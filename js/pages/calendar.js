// The calendar page.

import { sekki, setChrome } from '../core/router.js';
import { S } from '../core/state.js';
import { daysBetween, niceDate, pd, todayStr } from '../core/util.js';
import { effDue, sortTasks, taskLi, taskVisible } from '../garden/tasks.js';

export function pageCalendar() {
  setChrome('Calendar', { tab: 'cal', kicker: niceDate(todayStr()), sub: sekki() });
  const td = todayStr();
  const open = sortTasks(S.tasks.filter(t => !t.done && taskVisible(t)));
  const groups = {};
  for (const t of open) (groups[effDue(t)] = groups[effDue(t)] || []).push(t);
  const keys = Object.keys(groups).sort();
  const head = d => { const n = daysBetween(td, d); return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : niceDate(d) + (n < 7 ? '' : ` · in ${n} days`); };
  let lastMonth = '';
  const html = keys.length ? keys.map(d => {
    const mth = pd(d).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const mh = mth !== lastMonth ? `<h2 class="month">${mth}</h2>` : ''; lastMonth = mth;
    return `${mh}<section class="day${d === td ? ' is-today' : ''}"><h3>${head(d)}</h3><ul class="tasks">${groups[d].map(t => taskLi(t)).join('')}</ul></section>`;
  }).join('') : `<div class="empty-state">No upcoming tasks.<br><small>Tasks come from your plantings — thinning, fertiliser, harvest, and anything you add.</small></div>`;
  return { html: `<div class="btnrow"><a class="btn small" href="#/plan">📅 Season plan</a><a class="btn small" href="#/sprayday">💦 Spray days</a></div>` + html };
}
