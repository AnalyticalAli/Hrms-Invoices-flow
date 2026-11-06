const fs = require('fs');
const html = fs.readFileSync(require('path').join(__dirname, '..', 'aptcore-hrms-invoicing.html'), 'utf8');
const checks = [
  ['dueRelLabel', html.includes('function dueRelLabel')],
  ['attActionBtn', html.includes('function attActionBtn')],
  ['renderAttItem', html.includes('function renderAttItem')],
  ['ACT.attToggle', html.includes('ACT.attToggle')],
  ['ACT.attBulkRemind', html.includes('ACT.attBulkRemind')],
  ['Reminder settings', html.includes('Reminder settings')],
  ['Needs your attention', html.includes('Needs your attention')],
  ['fin-row', html.includes('fin-row')],
  ['sched-row', html.includes('sched-row')],
  ['View all', html.includes('View all')],
  ['ui.att state', html.includes("att:{ filter:'all'")],
];
let ok = true;
checks.forEach(([k, v]) => {
  console.log(v ? 'OK' : 'MISSING', k);
  if (!v) ok = false;
});
const m = html.match(/<script>\s*'use strict';([\s\S]*?)<\/script>\s*<script src/);
if (!m) {
  console.log('no main script match');
  process.exit(1);
}
try {
  new Function(m[1]);
  console.log('SYNTAX OK');
} catch (e) {
  console.log('SYNTAX ERROR', e.message);
  ok = false;
}
process.exit(ok ? 0 : 1);
