/* Payroll runs and reports for the existing APTCORE shell.
   Calculation, approval and finalization stay in this file. Reports only read the runs.
   shortcut: the salary register is not virtualized, upgrade past ~200 included employees. */
(function (root) {
  'use strict';

  const PR_DEPT = { eng: 'Engineering', people: 'People Operations', fin: 'Finance', sales: 'Sales' };
  const PR_STATUS = {
    draft: ['Draft', 'neutral'],
    review: ['Under Review', 'pending'],
    approved: ['Approved', 'info'],
    finalized: ['Finalized', 'info'],
    paid: ['Paid', 'success'],
    rejected: ['Rejected', 'danger']
  };
  const PR_TABS = [
    ['exec', 'Executive Overview', 'pie'],
    ['register', 'Salary Register', 'list'],
    ['statutory', 'Statutory Reports', 'shield'],
    ['dept', 'Department Analysis', 'building'],
    ['trends', 'Monthly Trends', 'performance']
  ];

  function prNum(v) { return typeof v === 'number' ? v : 0; }
  function inr(n) {
    const v = Math.round(+n || 0);
    return (v < 0 ? '−' : '') + '₹' + Math.abs(v).toLocaleString('en-IN');
  }
  function prDeptId(d) {
    const alias = { it: 'eng', IT: 'eng', It: 'eng', engineering: 'eng' };
    return alias[d] || d || '';
  }
  function prDeptName(d) { return PR_DEPT[prDeptId(d)] || 'Unknown department'; }
  function prLine(raw) {
    const l = Object.assign({}, raw);
    if (l.blocked) return l;
    l.gross = prNum(l.basic) + prNum(l.hra) + prNum(l.special) + prNum(l.otherE);
    l.ded = prNum(l.epf) + prNum(l.esi) + prNum(l.pt) + prNum(l.tds) + prNum(l.lop) + prNum(l.otherD);
    l.net = l.gross - l.ded;
    return l;
  }
  function prActive(run) {
    return (run && run.lines || []).map(prLine).filter(l => l.included !== false && !l.blocked);
  }
  function prTotals(lines) {
    const t = { n: lines.length, gross: 0, ded: 0, net: 0, epf: 0, esi: 0, pt: 0, tds: 0, lop: 0, otherD: 0, epfEr: 0, esiEr: 0, ot: 0, basic: 0, hra: 0, special: 0, otherE: 0 };
    lines.forEach(l => {
      ['gross', 'ded', 'net', 'epf', 'tds', 'lop', 'otherD', 'ot', 'basic', 'hra', 'special', 'otherE'].forEach(k => { t[k] += prNum(l[k]); });
      t.esi += prNum(l.esi); t.pt += prNum(l.pt); t.epfEr += prNum(l.epfEr); t.esiEr += prNum(l.esiEr);
    });
    t.empty = !lines.length;
    return t;
  }
  function prByDept(lines) {
    const map = {};
    lines.forEach(l => {
      const id = prDeptId(l.dept);
      const row = map[id] || (map[id] = { id, name: prDeptName(l.dept), n: 0, gross: 0, ded: 0, net: 0, ot: 0 });
      row.n++; row.gross += l.gross; row.ded += l.ded; row.net += l.net; row.ot += prNum(l.ot);
    });
    return Object.values(map).sort((a, b) => b.net - a.net);
  }
  function prClosed(run) { return run && (run.status === 'paid' || run.status === 'finalized'); }
  function prLatest(runs) {
    return (runs || []).filter(prClosed).slice().sort((a, b) => (b.periodEnd + b.id).localeCompare(a.periodEnd + a.id))[0] || null;
  }
  function prMonthNet(runs, month) {
    return (runs || []).filter(r => r.periodEnd.slice(0, 7) === month && prClosed(r)).reduce((s, r) => s + prTotals(prActive(r)).net, 0);
  }
  function prBaseLines() {
    return [
      { id: 'E1042', name: 'Ananya Krishnamurthy Rao', dept: 'IT', basic: 45000, hra: 18000, special: 12000, otherE: 1801, epf: 5400, esi: null, pt: 200, tds: 4500, lop: 0, otherD: 0, ot: 6, epfEr: 5400, esiEr: null },
      { id: 'E1088', name: 'Karthik Menon', dept: 'eng', basic: 52000, hra: 20800, special: 15000, otherE: 2000, epf: 6240, esi: null, pt: 200, tds: 6200, lop: 0, otherD: 0, ot: 4, epfEr: 6240, esiEr: null },
      { id: 'E1104', name: 'Meera Subramanian Iyer', dept: 'people', basic: 38000, hra: 15200, special: 8000, otherE: 0, epf: 4560, esi: 459, pt: 200, tds: 1800, lop: 0, otherD: 0, ot: 0, epfEr: 4560, esiEr: 1989 },
      { id: 'E1120', name: 'Rohan Desai', dept: 'fin', basic: 42000, hra: 16800, special: 10000, otherE: 1500, epf: 5040, esi: null, pt: 200, tds: 3200, lop: 2500, otherD: 0, ot: 0, epfEr: 5040, esiEr: null },
      { id: 'E1156', name: 'Sana Qureshi', dept: 'sales', basic: 30000, hra: 12000, special: 6000, otherE: 0, epf: 3600, esi: 360, pt: 150, tds: 800, lop: 0, otherD: 0, ot: 0, epfEr: 3600, esiEr: 1560 },
      { id: 'E1172', name: 'Vikram Nair', dept: 'eng', basic: 28000, hra: 11200, special: 5000, otherE: 0, epf: 3360, esi: 331, pt: 150, tds: 400, lop: 0, otherD: 0, ot: 0, epfEr: 3360, esiEr: 1436 }
    ];
  }
  function prCopy(lines, patch) {
    return lines.map(l => Object.assign({}, l, patch && patch[l.id] || {}, { included: true, payslip: false, excludeReason: '' }));
  }
  function prBlocked() {
    return { id: 'E1204', name: 'Priya Shah', dept: 'eng', blocked: 'missing-salary', included: false, excludeReason: '',
      detail: 'No salary structure is on file. Add Basic, HRA and allowances, then recalculate. Priya was not included in this run.' };
  }
  function prBuildRuns() {
    const base = prBaseLines();
    const nov = prCopy(base).concat([prBlocked()]);
    nov.forEach(l => { if (!l.blocked) l.payslip = true; });
    const oct = prCopy(base, { E1042: { special: 11000, otherE: 0 } });
    oct.forEach(l => { l.payslip = true; });
    const sep = prCopy(base, { E1042: { special: 10000, otherE: 0 } });
    sep.forEach(l => { l.payslip = true; });
    const dec = prCopy(base).concat([prBlocked()]);
    const rejected = prCopy(base).concat([prBlocked()]);
    const log = (at, who, text) => ({ at, who, text });
    return [
      { id: 'PR-2026-12', monthLabel: 'December 2026', periodStart: '2026-12-01', periodEnd: '2026-12-31', status: 'draft', processed: '', paidOn: '', rejection: '', calculatedAt: '2026-12-01',
        history: [log('2026-12-01', 'APTCORE', 'Draft calculated from salary structures, attendance, approved timesheets and leave. Not submitted.')], lines: dec },
      { id: 'PR-2026-11R', monthLabel: 'November 2026', periodStart: '2026-11-01', periodEnd: '2026-11-30', status: 'rejected', processed: '', paidOn: '',
        rejection: 'Engineering attendance was still open. Correct it and resubmit. This run was not deleted.',
        calculatedAt: '2026-11-20',
        history: [log('2026-11-20', 'Ganesh (Maker)', 'Submitted a preliminary November run.'), log('2026-11-21', 'N. Iyer (Checker)', 'Rejected: Engineering attendance was still open. Returned to the maker.')],
        lines: rejected },
      { id: 'PR-2026-11', monthLabel: 'November 2026', periodStart: '2026-11-01', periodEnd: '2026-11-30', status: 'paid', processed: '2026-11-28', paidOn: '2026-12-02', rejection: '', calculatedAt: '2026-11-25',
        history: [
          log('2026-11-25', 'Ganesh (Maker)', 'Submitted November payroll for review.'),
          log('2026-11-26', 'N. Iyer (Checker)', 'Approved. Priya Shah stays out until a salary structure exists.'),
          log('2026-11-28', 'Ganesh (Admin)', 'Finalized. Payslips generated. No bank transfer was sent.'),
          log('2026-12-02', 'Finance (recorded)', 'Marked paid after finance confirmed the transfer outside APTCORE.')
        ], lines: nov },
      { id: 'PR-2026-10', monthLabel: 'October 2026', periodStart: '2026-10-01', periodEnd: '2026-10-31', status: 'paid', processed: '2026-10-28', paidOn: '2026-10-31', rejection: '', calculatedAt: '2026-10-25',
        history: [log('2026-10-31', 'Finance (recorded)', 'Marked paid after an external transfer.')], lines: oct },
      { id: 'PR-2026-09', monthLabel: 'September 2026', periodStart: '2026-09-01', periodEnd: '2026-09-30', status: 'paid', processed: '2026-09-27', paidOn: '2026-09-30', rejection: '', calculatedAt: '2026-09-24',
        history: [log('2026-09-30', 'Finance (recorded)', 'Marked paid after an external transfer.')], lines: sep }
    ];
  }
  const PR_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function prMonthLabel(ym) {
    const p = String(ym || '').split('-');
    return (PR_MONTHS[+p[1] - 1] || ym) + ' ' + (p[0] || '');
  }
  function prPeriodEnd(ym) {
    const p = String(ym || '').split('-');
    const y = +p[0], m = +p[1];
    if (!y || m < 1 || m > 12) return '';
    return ym + '-' + String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0');
  }
  function prClash(runs, ym) {
    return (runs || []).find(r => r.periodEnd.slice(0, 7) === ym && r.status !== 'rejected') || null;
  }
  function prEarnings(l) { return prNum(l.basic) + prNum(l.hra) + prNum(l.special) + prNum(l.otherE); }
  function prAnnualCtc(l) {
    if (!l || l.blocked) return null;
    return (prEarnings(l) + prNum(l.epfEr) + prNum(l.esiEr)) * 12;
  }
  function prScaleEarnings(l, target) {
    const cur = prEarnings(l);
    if (!(cur > 0) || !(target > 0)) return false;
    const ratio = target / cur;
    ['basic', 'hra', 'special', 'otherE'].forEach(k => { l[k] = Math.round(prNum(l[k]) * ratio); });
    l.otherE = prNum(l.otherE) + (target - prEarnings(l));
    l.ctcEdited = target !== cur;
    return true;
  }
  function prStat(t) { return prNum(t.epf) + prNum(t.esi) + prNum(t.pt) + prNum(t.tds); }
  function prMonthSeries(runs) {
    const closed = (runs || []).filter(prClosed).slice().sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.id.localeCompare(b.id));
    const months = [], seen = {};
    closed.forEach(r => {
      const key = r.periodEnd.slice(0, 7);
      let row = seen[key];
      if (!row) {
        row = seen[key] = { month: key, name: r.monthLabel, gross: 0, ded: 0, net: 0, n: 0, status: r.status, runId: r.id };
        months.push(row);
      }
      const t = prTotals(prActive(r));
      row.gross += t.gross; row.ded += t.ded; row.net += t.net; row.n += t.n;
      if (r.periodEnd >= key && r.id >= row.runId) { row.runId = r.id; row.status = r.status; row.name = r.monthLabel; }
    });
    const pct = (cur, base) => base ? (cur - base) / base * 100 : 0;
    months.forEach((row, i) => {
      const prev = months[i - 1];
      row.delta = prev ? {
        net: row.net - prev.net, netPct: pct(row.net, prev.net),
        gross: row.gross - prev.gross, grossPct: pct(row.gross, prev.gross),
        ded: row.ded - prev.ded, dedPct: pct(row.ded, prev.ded),
        n: row.n - prev.n
      } : null;
    });
    return months;
  }
  function prSelfCheck(runs) {
    const nov = runs.find(r => r.id === 'PR-2026-11');
    const t = prTotals(prActive(nov));
    const deptNet = prByDept(prActive(nov)).reduce((s, d) => s + d.net, 0);
    const latest = prLatest(runs);
    const month = prMonthNet(runs, '2026-11');
    const statutory = prStat(t);
    const sample = Object.assign({}, prBaseLines()[0]);
    const scaled = prScaleEarnings(sample, prEarnings(sample));
    return {
      ok: t.n === 6 && t.gross === 390301 && t.ded === 49850 && statutory === 47350 && t.lop === 2500 && t.net === 340451 &&
        t.gross - t.ded === t.net && deptNet === t.net && latest && latest.id === 'PR-2026-11' && month === 340451 &&
        statutory + t.lop + t.otherD === t.ded && scaled && sample.epf === 5400 && prEarnings(sample) === 76801,
      net: t.net, gross: t.gross, ded: t.ded, deptNet, latest: latest && latest.id, month, statutory, n: t.n, lop: t.lop
    };
  }
  function prFlowCheck(runs) {
    const series = prMonthSeries(runs);
    const row = series.find(s => s.month === '2026-11');
    const clash = prClash(runs, '2026-11');
    const check = prSelfCheck(runs);
    return {
      ok: !!(check.ok && clash && clash.id === 'PR-2026-11' && !prClash(runs, '2027-01') && prPeriodEnd('2027-01') === '2027-01-31' &&
        row && row.gross === 390301 && row.ded === 49850 && row.net === 340451 && row.n === 6 && row.status === 'paid' &&
        series.length === 3 && series[1].delta && series[1].delta.net !== 0),
      series: series.length, jan: prPeriodEnd('2027-01')
    };
  }

  const api = { prBuildRuns, prSelfCheck, prFlowCheck, prTotals, prActive, prLatest, prMonthNet, prMonthSeries, prClash, inr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root || !root.document || typeof root.document.getElementById !== 'function') return;

  function prEnsure() {
    if (!S.settings.payrollMode) S.settings.payrollMode = 'maker';
    if (!S.ui.nestsOpen) S.ui.nestsOpen = {};
    if (S.ui.nestsOpen.payroll == null) S.ui.nestsOpen.payroll = true;
    const dflt = { runId: 'PR-2026-11', tab: 'exec', q: '', dept: '', sort: 'name', dir: 1, actor: 'admin', preview: 'live', busy: false, trendStatus: '', rejectReason: '', exportErr: '', step: '', formMonth: '', formTried: false, pickQ: '', pickDept: '', edit: {}, struct: {}, protoOpen: false };
    S.ui.pr = Object.assign(dflt, S.ui.pr || {});
    if (!S.data.payruns || S.data.payrollV !== 1) {
      S.data.payruns = prBuildRuns();
      S.data.payrollV = 1;
    }
  }
  function prRuns() { return S.data.payruns || []; }
  function prRun(id) { return prRuns().find(r => r.id === (id || S.ui.pr.runId)) || null; }
  function prMode() { return S.settings.payrollMode === 'single' ? 'single' : 'maker'; }
  function prActor() { return S.ui.pr.actor || 'admin'; }
  function prWho() {
    return { admin: 'Ganesh (Admin)', hr: 'Ganesh (HR)', maker: 'Ganesh (Maker)', checker: 'N. Iyer (Checker)', viewer: 'Viewer' }[prActor()] || 'Ganesh';
  }
  function prCan(act, run) {
    const a = prActor(), mode = prMode();
    const maker = a === 'maker' || a === 'admin' || a === 'hr';
    if (act === 'create') return maker;
    if (!run || a === 'viewer') return false;
    const checker = a === 'checker' || a === 'admin';
    if (act === 'edit' || act === 'calc') return maker && (run.status === 'draft' || run.status === 'rejected');
    if (mode === 'single') {
      if (act === 'submit') return false;
      if (act === 'approve' || act === 'reject') return (a === 'admin' || a === 'hr') && run.status === 'draft';
    } else {
      if (act === 'submit') return maker && a !== 'checker' && (run.status === 'draft' || run.status === 'rejected');
      if (act === 'approve' || act === 'reject') return checker && a !== 'maker' && run.status === 'review';
    }
    if (act === 'finalize') return (a === 'admin' || a === 'hr' || (mode === 'maker' && a === 'checker')) && run.status === 'approved';
    if (act === 'paid') return a === 'admin' && run.status === 'finalized';
    return false;
  }
  function prSuggestMonth() {
    let y = 2026, m = 10;
    for (let i = 0; i < 24; i++) {
      const ym = y + '-' + String(m).padStart(2, '0');
      if (!prClash(prRuns(), ym)) return ym;
      m += 1; if (m > 12) { m = 1; y += 1; }
    }
    return '2027-01';
  }
  function prStepFor(run) {
    if (!run) return '';
    if (run.status === 'review') return 'approve';
    if (run.status === 'approved') return 'final';
    if (run.status === 'finalized' || run.status === 'paid') return 'done';
    return run.step || 'select';
  }
  function prIsCalc(run) { return !!(run && run.calculated !== false && run.calculatedAt); }
  function prDirty(run) { if (run && (run.status === 'draft' || run.status === 'rejected')) run.calculated = false; }
  function prLog(run, text) { run.history.unshift({ at: TODAY, who: prWho(), text }); }
  function prDuplicate(run) {
    return prRuns().find(r => r.id !== run.id && r.periodEnd.slice(0, 7) === run.periodEnd.slice(0, 7) && prClosed(r)) || null;
  }
  function prLabel(r) {
    const st = PR_STATUS[r.status][0];
    const twins = prRuns().filter(x => x.monthLabel === r.monthLabel && x.status === r.status);
    return r.monthLabel + ' (' + st + ')' + (twins.length > 1 ? ' · ' + r.id : '');
  }
  function prShownRun() {
    const p = S.ui.pr.preview;
    if (p === 'norun' || p === 'error' || p === 'denied') return null;
    return prRun();
  }
  function prQuality(run) {
    if (!run) return [];
    const lines = prActive(run);
    const t = prTotals(lines);
    const deptNet = prByDept(lines).reduce((s, d) => s + d.net, 0);
    const issues = [];
    if (!t.empty && deptNet !== t.net) issues.push('Department net does not match the salary register.');
    if (!t.empty && t.gross - t.ded !== t.net) issues.push('Net payroll does not match gross minus deductions.');
    lines.forEach(l => { if (l.net !== l.gross - l.ded) issues.push(l.name + ': net pay does not match earnings minus deductions.'); });
    if (S.ui.pr.preview === 'badmath') issues.push('Simulated mismatch: a previous total was read from the wrong run. The figures on this page are still this run.');
    return issues;
  }
  function prCell(v, emptyLabel) {
    if (v == null) return '<span class="pr-na">' + esc(emptyLabel || 'Not applicable') + '</span>';
    if (v === 'nc') return '<span class="pr-na">Not configured</span>';
    return '<span class="tnum">' + inr(v) + '</span>';
  }
  function prStatusBadge(st) { const s = PR_STATUS[st] || ['Unknown', 'neutral']; return badge(s[0], s[1], st === 'finalized' ? 'pr-final' : ''); }
  function prMoneyOrPending(run, n) {
    if (!run || prTotals(prActive(run)).empty) return '<span class="pr-na">Not calculated</span>';
    return '<span class="tnum">' + inr(n) + '</span>';
  }
  function prWarn(issues) {
    if (!issues.length) return '';
    return alertBox('warning', 'alert', '<span><b>Check these figures before you rely on them.</b> ' + issues.map(esc).join(' ') + '</span>');
  }
  function prBusy() {
    return S.ui.pr.busy ? '<div class="pr-busy" role="status">' + ic('refresh', 16) + '<span>Updating the report…</span></div>' : '';
  }
  function prControls(extra) {
    const runs = prRuns();
    const mode = prMode();
    return '<div class="card"><div class="card-body" style="padding-top:16px"><div class="row wrap" style="gap:12px;align-items:flex-end">' +
      field('Pay run', sel('pr-run', 'ui.pr.runId', S.ui.pr.preview === 'norun' ? '' : S.ui.pr.runId, [['', 'Select a pay run…']].concat(runs.map(r => [r.id, prLabel(r)])), { style: 'width:auto;min-width:260px', aria: 'Pay run' }), { for: 'pr-run', help: 'Reports and the run detail use this selection.' }) +
      field('Approval setup', sel('pr-mode', 'settings.payrollMode', mode, [['maker', 'Maker–checker'], ['single', 'Single-level']], { style: 'width:auto', aria: 'Approval setup' }), { for: 'pr-mode', help: mode === 'single' ? 'An authorized approver approves the draft directly.' : 'Maker submits. Checker approves or rejects.' }) +
      field('Act as', sel('pr-actor', 'ui.pr.actor', prActor(), [['admin', 'Admin'], ['hr', 'HR'], ['maker', 'Maker'], ['checker', 'Checker'], ['viewer', 'Viewer']], { style: 'width:auto', aria: 'Preview role' }), { for: 'pr-actor', help: 'HR prepares payroll. In maker–checker, only the checker approves. Viewer cannot prepare or approve. Recording an external payment stays with Admin.' }) +
      (extra || '') +
      '</div><details class="pr-noprint"><summary class="small muted">Prototype states</summary><div class="row wrap" style="margin-top:8px">' +
      field('Preview', sel('pr-prev', 'ui.pr.preview', S.ui.pr.preview, [['live', 'Normal'], ['error', 'Load error'], ['denied', 'Permission denied'], ['norun', 'No pay run'], ['nohistory', 'No history'], ['badmath', 'Reconciliation warning']], { style: 'width:auto', aria: 'Prototype preview state' }), { for: 'pr-prev', help: 'Sample states only. Normal is the product path.' }) +
      '</div></details></div></div>';
  }
  function prContext(run) {
    if (!run) return alertBox('info', 'info', '<span>Select a pay run. Totals stay blank until a run is selected — they are not shown as zero.</span>');
    const t = prTotals(prActive(run));
    const blocked = (run.lines || []).filter(l => l.blocked).length;
    return '<div class="row wrap" style="gap:8px 16px;align-items:center"><span class="medium">' + esc(run.id) + '</span>' + prStatusBadge(run.status) +
      '<span class="small muted">' + esc(run.periodStart) + ' – ' + esc(run.periodEnd) + '</span>' +
      '<span class="small muted">' + (t.empty ? 'No employees included' : t.n + ' employees in run') + (blocked ? ' · ' + blocked + ' not included' : '') + '</span>' +
      '<span class="small muted">Payslips ' + (prClosed(run) ? 'generated' : 'not generated') + ' · ' + (run.status === 'paid' ? 'Paid amount recorded ' + inr(t.net) : 'Paid amount not recorded') + '</span></div>' +
      (t.empty ? '' : '<p class="small" style="margin:8px 0 0">' + prDeductionExplain(run) + '</p>') +
      (run.id === 'PR-2026-11' ? '<p class="small" style="margin:6px 0 0">This run’s file has 6 included employees. A screenshot that showed 12 is not in these records, so the headcount was left at 6. Gross, deductions and statutory amounts below are the sum of those 6 lines.</p>' : '') +
      (run.rejection && (run.status === 'rejected' || run.status === 'draft') ? alertBox('warning', 'alert', '<span><b>Rejection reason.</b> ' + esc(run.rejection) + '</span>') : '');
  }
  function prDeductionExplain(run) {
    const lines = prActive(run);
    const t = prTotals(lines);
    const stat = prStat(t);
    const lop = lines.filter(l => l.lop).map(l => esc(l.name) + ' ' + inr(l.lop)).join(', ');
    return 'Employee statutory deductions <b>' + inr(stat) + '</b> (EPF, ESI, professional tax, TDS). Total deductions <b>' + inr(t.ded) + '</b>. The remaining <b>' + inr(t.ded - stat) + '</b> is loss of pay' + (lop ? ' (' + lop + ')' : ' ' + inr(t.lop)) + ' and other deductions ' + inr(t.otherD) + '.';
  }
  function prKpi(label, valueHtml, tip, sub, focus) {
    return '<div class="kpi' + (focus ? ' pr-focus' : '') + '"><div class="kpi-top"><span class="kpi-lbl">' + esc(label) + '</span>' + qmark(tip) + '</div><div class="kpi-val tnum">' + valueHtml + '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
  }
  function prBars(rows, key, opt) {
    const o = opt === true ? { money: true } : (opt || {});
    const max = rows.reduce((m, r) => Math.max(m, r[key] || 0), 0) || 1;
    if (!rows.length) return '<p class="small muted">Nothing to chart.</p>';
    return '<div class="pr-bar-list">' + rows.map(r => {
      const raw = r[key] || 0;
      const width = raw ? Math.max(2, Math.round(raw / max * 100)) : 0;
      const val = o.money ? inr(raw) : String(raw);
      const meta = [];
      if (o.head && r.n != null) meta.push(r.n + (r.n === 1 ? ' person' : ' people'));
      if (o.share != null && o.share > 0) meta.push((Math.round(raw / o.share * 1000) / 10).toFixed(1) + '%');
      const name = '<span class="pr-bar-name">' + esc(r.name) + (meta.length ? '<span class="pr-bar-meta">' + meta.join(' · ') + '</span>' : '') + '</span>';
      const bar = '<span class="pr-bar-track" role="presentation"><span style="width:' + width + '%;min-width:' + (raw ? '2px' : '0') + '"></span></span><span class="pr-bar-val">' + val + '</span>';
      const cls = 'pr-bar' + (o.tone ? ' is-' + o.tone : '') + (o.act ? ' pr-bar-btn' : '');
      if (!o.act) return '<div class="' + cls + '">' + name + bar + '</div>';
      const hint = o.act === 'prEmp' ? 'Open the calculation.' : 'Open the salary register for this department.';
      return '<button type="button" class="' + cls + '" data-act="' + o.act + '" data-a="' + esc(r.id || '') + '" aria-label="' + esc(r.name + ', ' + val + '. ' + hint) + '">' + name + bar + '</button>';
    }).join('') + '</div>';
  }
  function prVar(cur, prev, label) {
    if (prev == null || !prev) return '';
    const abs = cur - prev;
    const pct = abs / prev * 100;
    const sign = abs > 0 ? '+' : abs < 0 ? '−' : '';
    return '<span class="pr-delta tnum">' + sign + Math.abs(pct).toFixed(1) + '% vs ' + esc(label) + '</span>';
  }
  function prDay(iso, withYear) {
    const p = String(iso || '').split('-');
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p[1] - 1];
    if (!mon || p.length < 3) return iso || '—';
    return p[2] + ' ' + mon + (withYear ? ' ' + p[0] : '');
  }
  function prRange(run) {
    if (!run) return '';
    const y1 = String(run.periodStart).slice(0, 4), y2 = String(run.periodEnd).slice(0, 4);
    if (y1 && y1 === y2) return prDay(run.periodStart) + ' – ' + prDay(run.periodEnd) + ' ' + y1;
    return prDay(run.periodStart, true) + ' – ' + prDay(run.periodEnd, true);
  }
  function prFilter(lines) {
    const q = String(S.ui.pr.q || '').trim().toLowerCase();
    const dept = S.ui.pr.dept;
    return lines.filter(l => {
      if (dept && prDeptId(l.dept) !== dept) return false;
      if (!q) return true;
      return (l.name + ' ' + l.id + ' ' + prDeptName(l.dept)).toLowerCase().indexOf(q) >= 0;
    });
  }
  function prSortLines(lines) {
    const k = S.ui.pr.sort || 'name', dir = S.ui.pr.dir || 1;
    const val = l => {
      if (k === 'name' || k === 'id') return l[k] || '';
      if (k === 'dept') return prDeptName(l.dept);
      if (l.blocked) return -1;
      return prNum(l[k]);
    };
    return lines.slice().sort((a, b) => {
      const va = val(a), vb = val(b);
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  }
  function prTh(key, label, align) {
    const on = S.ui.pr.sort === key;
    return '<th class="' + (align || '') + '"><button type="button" class="pr-sort" data-act="prSort" data-a="' + key + '" aria-label="Sort by ' + esc(label) + '">' + esc(label) + (on ? (S.ui.pr.dir > 0 ? ' ↑' : ' ↓') : '') + '</button></th>';
  }
  function prSumStrip(t, label) {
    if (t.empty) return '<p class="small muted" style="margin:0">' + esc(label || 'No employees included. This is not a payroll of ₹0.') + '</p>';
    return '<div class="pr-sum"><div><span>Gross payroll</span><b>' + inr(t.gross) + '</b></div><div><span>Total deductions</span><b>' + inr(t.ded) + '</b></div><div><span>Net payroll payable</span><b>' + inr(t.net) + '</b></div><div><span>Employees in run</span><b>' + t.n + '</b></div></div>';
  }
  function prExportBtn(kind, label) {
    return btn(label || 'Export CSV', { act: 'prExport', a: kind, cls: 'btn-sm', icon: 'download' });
  }

  function prReportBar(run) {
    const t = run ? prTotals(prActive(run)) : null;
    const blocked = run ? (run.lines || []).filter(l => l.blocked).length : 0;
    const facts = !run
      ? '<span class="pr-chip">No pay run selected</span>'
      : '<span class="pr-chip">' + esc(prRange(run)) + '</span>' + prStatusBadge(run.status) +
        '<span class="pr-chip" data-tip="' + esc(blocked ? blocked + ' not included. They stay on the register.' : 'Included after eligibility checks.') + '">' +
        (t.empty ? 'None included' : t.n + (t.n === 1 ? ' employee' : ' employees')) + '</span>';
    return '<div class="pr-context"><label class="pr-run-lbl" for="pr-run">Pay run</label>' +
      sel('pr-run', 'ui.pr.runId', S.ui.pr.preview === 'norun' ? '' : S.ui.pr.runId, [['', 'Select a pay run…']].concat(prRuns().map(r => [r.id, r.monthLabel + ' — ' + r.id])), { style: 'width:auto;min-width:260px', aria: 'Pay run' }) +
      facts + '</div>';
  }
  function prProto(run) {
    const mode = prMode();
    return '<details class="pr-proto pr-noprint"' + (S.ui.pr.protoOpen ? ' open' : '') + '><summary>Prototype settings</summary><div class="pr-proto-body">' +
      '<p class="xs muted">Simulation only. These are not organisation permissions.</p>' +
      '<div class="row wrap" style="gap:12px;align-items:flex-end">' +
      field('Approval setup', sel('pr-mode', 'settings.payrollMode', mode, [['maker', 'Maker–checker'], ['single', 'Single-level']], { style: 'width:auto', aria: 'Approval setup' }), { for: 'pr-mode', help: mode === 'single' ? 'An authorized approver approves the draft directly.' : 'Maker submits. Checker approves or rejects.' }) +
      field('Act as', sel('pr-actor', 'ui.pr.actor', prActor(), [['admin', 'Admin'], ['hr', 'HR'], ['maker', 'Maker'], ['checker', 'Checker'], ['viewer', 'Viewer']], { style: 'width:auto', aria: 'Preview role' }), { for: 'pr-actor', help: 'Preview role for this session.' }) +
      field('Preview', sel('pr-prev', 'ui.pr.preview', S.ui.pr.preview, [['live', 'Normal'], ['error', 'Load error'], ['denied', 'Permission denied'], ['norun', 'No pay run'], ['nohistory', 'No history'], ['badmath', 'Reconciliation warning']], { style: 'width:auto', aria: 'Prototype preview state' }), { for: 'pr-prev', help: 'Sample states only. Normal is the product path.' }) +
      '</div>' +
      (run && run.id === 'PR-2026-11' ? '<p class="xs muted">This run’s file has 6 included employees. A screenshot that showed 12 is not in these records.</p>' : '') +
      '</div></details>';
  }
  function prTabs(tab) {
    return '<div class="pr-tabs" role="tablist" aria-label="Payroll reports">' + PR_TABS.map(function (item) {
      return '<button type="button" role="tab" id="pr-tab-' + item[0] + '" aria-selected="' + (tab === item[0]) + '" aria-controls="pr-panel" data-act="prTab" data-a="' + item[0] + '">' + ic(item[2], 15, 2) + '<span>' + esc(item[1]) + '</span></button>';
    }).join('') + '</div>';
  }
  function prReportShell(inner) {
    const run = prShownRun();
    return '<div class="page">' +
      pageHead('Payroll reports', 'Analyse payroll costs, employee earnings and statutory deductions.', btn('Pay runs', { act: 'go', a: '#/payruns', icon: 'cash' })) +
      prReportBar(run) + prProto(run) + prBusy() +
      (S.ui.pr.exportErr ? alertBox('danger', 'alert', '<span>' + esc(S.ui.pr.exportErr) + '</span>') : '') +
      inner + '</div>';
  }
  function vPayroll() {
    prEnsure();
    const preview = S.ui.pr.preview;
    if (preview === 'denied') {
      return prReportShell('<section class="card">' + emptyState('Permission denied', 'This preview blocks payroll amounts. Set Preview back to Normal under Prototype settings. Nothing was exported.', '', 'neutral') + '</section>');
    }
    if (preview === 'error') {
      return prReportShell('<section class="card">' + emptyState('Payroll reports could not be loaded', 'The last request failed. Figures are hidden so a failed load is not shown as ₹0.', btn('Retry', { act: 'prPreview', a: 'live', cls: 'btn-primary' }), 'neutral') + '</section>');
    }
    const run = prShownRun();
    const tab = S.ui.pr.tab || 'exec';
    let body = '';
    if (tab === 'trends') body = prTrends(run);
    else if (!run) body = '<section class="card">' + emptyState('No pay run selected', 'Choose a pay run to see gross payroll, deductions and net payable.', '', 'neutral') + '</section>';
    else if (tab === 'register') body = prRegister(run);
    else if (tab === 'statutory') body = prStatutory(run);
    else if (tab === 'dept') body = prDept(run);
    else body = prExec(run);
    const reject = run && run.rejection && (run.status === 'rejected' || run.status === 'draft')
      ? alertBox('warning', 'alert', '<span><b>Rejected.</b> ' + esc(run.rejection) + '</span>') : '';
    return prReportShell(reject + prTabs(tab) + '<div id="pr-panel" role="tabpanel" aria-labelledby="pr-tab-' + tab + '">' + body + '</div>');
  }

  function prStatusLine(run, t) {
    const recorded = run.status === 'paid';
    const title = PR_STATUS[run.status][0] + (recorded ? ' · Payment recorded' : ' · Payment not recorded');
    const detail = recorded
      ? 'Finance confirmed an external payment' + (t.empty ? '.' : ' of ' + inr(t.net) + '.')
      : 'Net payroll payable is calculated. Salary payment has not been confirmed.';
    return '<div class="pr-status' + (recorded ? ' is-paid' : '') + '"><b>' + esc(title) + '</b><span>' + detail + '</span>' +
      qmark('Finalizing generates payslips. It does not transfer salaries. Paid is shown only after an external payment is recorded.') + '</div>';
  }
  function prComp(title, rows, tone, tip) {
    return '<div><h3 class="pr-comp-h">' + esc(title) + (tip ? ' ' + qmark(tip) : '') + '</h3>' +
      prBars(rows.map(function (r) { return { name: r[0], v: r[1] }; }), 'v', { money: true, tone: tone }) + '</div>';
  }
  function prExec(run) {
    const lines = prActive(run);
    const t = prTotals(lines);
    const issues = prQuality(run);
    const prev = prRuns().filter(r => prClosed(r) && r.periodEnd < run.periodEnd).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
    const pt = prev ? prTotals(prActive(prev)) : null;
    const depts = prByDept(lines);
    const people = lines.slice().sort((a, b) => b.net - a.net);
    const top = people.slice(0, 5);
    const pending = t.empty;
    const held = (run.lines || []).filter(l => l.blocked || l.included === false).length;
    const dash = pending ? '—' : null;
    const kpis = '<div class="pr-kpis">' +
      prKpi('Gross payroll', dash || inr(t.gross), 'Total gross earnings for employees included in this run.') +
      prKpi('Total deductions', dash || inr(t.ded), 'Employee deductions: EPF, ESI, professional tax, TDS, loss of pay and other deductions.') +
      prKpi('Net payroll payable', dash || inr(t.net), 'Gross payroll minus employee deductions. Calculated payable, not a bank transfer.', pt ? prVar(t.net, pt.net, prev.monthLabel) : '', true) +
      prKpi('Employees in run', dash || String(t.n), 'Employees included after eligibility checks.', held ? held + ' not included' : '') +
      prKpi('Employer contributions', dash || inr(t.epfEr + t.esiEr), 'Configured employer EPF and ESI. Not part of employee net pay, and not a filing.') +
      '</div>';
    const earn = [['Basic', t.basic], ['HRA', t.hra], ['Special allowance', t.special], ['Other earnings', t.otherE]];
    const ded = [['EPF', t.epf], ['ESI', t.esi], ['Professional tax', t.pt], ['TDS', t.tds], ['Loss of pay', t.lop], ['Other deductions', t.otherD]];
    const dedTip = 'Employee statutory ' + inr(prStat(t)) + '. Loss of pay ' + inr(t.lop) + ' and other deductions ' + inr(t.otherD) + ' sit outside statutory. Total deductions ' + inr(t.ded) + '.';
    return prWarn(issues) + '<div class="pr-band">' + prStatusLine(run, t) + kpis + '</div>' +
      '<div class="pr-split">' +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Department payroll</h2><span class="card-sub">Share of net payroll</span></div>' +
      btn('Open analysis', { act: 'prTab', a: 'dept', cls: 'btn-sm' }) + '</div><div class="card-body">' +
      (pending ? '<p class="small muted">No included employees.</p>' : prBars(depts, 'net', { money: true, head: true, share: t.net, act: 'prDrill' })) + '</div></section>' +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Employee net pay</h2><span class="card-sub">' + (people.length > 5 ? 'Top 5 of ' + people.length : 'Included employees') + '</span></div>' +
      btn('Open register', { act: 'prTab', a: 'register', cls: 'btn-sm' }) + '</div><div class="card-body">' +
      (pending ? '<p class="small muted">No included employees.</p>' : prBars(top, 'net', { money: true, act: 'prEmp' })) +
      '<table class="sr-only"><caption>Employee net pay</caption><tbody>' + people.map(l => '<tr><th scope="row">' + esc(l.name) + '</th><td>' + inr(l.net) + '</td></tr>').join('') + '</tbody></table></div></section></div>' +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Payroll composition</h2></div>' +
      btn('View details', { act: 'prTab', a: 'register', cls: 'btn-sm' }) + '</div><div class="card-body">' +
      (pending ? '<p class="small muted">Nothing to compose.</p>' : '<div class="pr-comp">' + prComp('Earnings', earn, 'earn') + prComp('Deductions', ded, 'ded', dedTip) + '</div>') +
      '</div></section>';
  }

  function prRegister(run) {
    const all = (run.lines || []).map(prLine);
    const filtered = prSortLines(prFilter(all));
    const active = prActive(run);
    const runT = prTotals(active);
    const viewT = prTotals(filtered.filter(l => !l.blocked && l.included !== false));
    const narrowed = !!(S.ui.pr.q || S.ui.pr.dept);
    const depts = [['', 'All departments']].concat(Object.keys(PR_DEPT).map(id => [id, PR_DEPT[id]]));
    const head = '<div class="toolbar" style="padding-top:16px"><label class="search">' + ic('search', 16) +
      '<input type="search" id="pr-q" data-model="ui.pr.q" data-live="input" value="' + esc(S.ui.pr.q) + '" placeholder="Name, ID or department" aria-label="Search employees"></label>' +
      sel('pr-dept', 'ui.pr.dept', S.ui.pr.dept, depts, { style: 'width:auto', aria: 'Department' }) +
      ((S.ui.pr.q || S.ui.pr.dept) ? btn('Reset filters', { act: 'prResetFilters', cls: 'btn-sm' }) : '') +
      '<span class="grow"></span>' + prExportBtn('register') + btn('Print', { act: 'prPrint', cls: 'btn-sm', icon: 'printer' }) + '</div>';
    if (!filtered.length) {
      return '<section class="card">' + head + emptyState('No matching employees', 'No one in this run matches the search or department. Reset filters to see the register.', '', 'neutral') + '</section>';
    }
    const cols = [['name', 'Employee'], ['id', 'Employee ID'], ['dept', 'Department'], ['basic', 'Basic', 'right'], ['hra', 'HRA', 'right'], ['special', 'Special allowance', 'right'], ['otherE', 'Other earnings', 'right'], ['gross', 'Gross pay', 'right'], ['epf', 'EPF', 'right'], ['esi', 'ESI', 'right'], ['pt', 'PT', 'right'], ['tds', 'TDS', 'right'], ['lop', 'LOP', 'right'], ['otherD', 'Other deductions', 'right'], ['ded', 'Total deductions', 'right'], ['net', 'Net pay', 'right']];
    const group = '<tr class="pr-groups"><th class="pr-gh" colspan="3">Employee</th><th class="pr-gh pr-gh-earn" colspan="5">Earnings</th><th class="pr-gh pr-gh-ded" colspan="7">Deductions</th><th class="pr-gh pr-gh-net">Final pay</th><th class="pr-gh"></th></tr>';
    const row = l => {
      if (l.blocked) {
        return '<tr><td><span class="pr-name">' + esc(l.name) + '</span></td><td class="mono">' + esc(l.id) + '</td><td>' + esc(prDeptName(l.dept)) + '</td><td colspan="13"><span class="pr-na">Not calculated</span> · ' + esc(l.detail) + '</td><td>' + btn('Why', { act: 'prEmp', a: l.id, cls: 'btn-xs' }) + '</td></tr>';
      }
      const cells = ['basic', 'hra', 'special', 'otherE', 'gross', 'epf', 'esi', 'pt', 'tds', 'lop', 'otherD', 'ded', 'net'].map(k => {
        const inner = k === 'esi' && l.esi == null ? prCell(null, 'Not applicable') : '<span class="tnum"' + (k === 'lop' && l.lop === 0 ? ' title="No loss of pay recorded for this period."' : '') + '>' + inr(l[k]) + '</span>';
        return '<td class="right">' + inner + '</td>';
      });
      return '<tr><td><span class="pr-name">' + esc(l.name) + '</span></td><td class="mono">' + esc(l.id) + '</td><td>' + esc(prDeptName(l.dept)) + '</td>' + cells.join('') + '<td>' + btn('Calculation', { act: 'prEmp', a: l.id, cls: 'btn-xs', icon: 'eye' }) + '</td></tr>';
    };
    const foot = viewT.empty ? '' : '<tfoot><tr><th colspan="3">Total' + (narrowed ? ' (filtered)' : '') + '</th><td class="right tnum">' + inr(viewT.basic) + '</td><td class="right tnum">' + inr(viewT.hra) + '</td><td class="right tnum">' + inr(viewT.special) + '</td><td class="right tnum">' + inr(viewT.otherE) + '</td><td class="right tnum">' + inr(viewT.gross) + '</td><td class="right tnum">' + inr(viewT.epf) + '</td><td class="right tnum">' + inr(viewT.esi) + '</td><td class="right tnum">' + inr(viewT.pt) + '</td><td class="right tnum">' + inr(viewT.tds) + '</td><td class="right tnum">' + inr(viewT.lop) + '</td><td class="right tnum">' + inr(viewT.otherD) + '</td><td class="right tnum">' + inr(viewT.ded) + '</td><th class="right tnum">' + inr(viewT.net) + '</th><td></td></tr></tfoot>';
    return prWarn(prQuality(run)) + '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Salary register ' + qmark('Net pay = gross pay − total deductions. Not calculated means the person was not included. Not applicable is not ₹0.') + '</h2><span class="card-sub">' + esc(run.monthLabel) + ' · ' + esc(run.id) + '</span></div></div>' +
      '<div class="card-body">' + prSumStrip(runT, 'No employees included. Net pay is not ₹0.') + (narrowed && !runT.empty ? '<p class="xs muted">Filtered net ' + inr(viewT.net) + '. Run net stays ' + inr(runT.net) + '.</p>' : '') + '</div>' +
      head + '<div class="tbl-wrap"><table class="tbl pr-reg" data-pr="1" style="min-width:1680px"><thead>' + group + '<tr>' + cols.map(c => prTh(c[0], c[1], c[2])).join('') + '<th></th></tr></thead><tbody>' +
      filtered.map(row).join('') + '</tbody>' + foot + '</table></div></section>';
  }

  function prStatutory(run) {
    const lines = prActive(run);
    const t = prTotals(lines);
    const ee = t.epf + t.esi + t.pt + t.tds;
    const dash = t.empty ? '—' : null;
    return prWarn(prQuality(run)) +
      '<div class="pr-band"><p class="pr-kicker">Employee deductions</p><div class="pr-kpis pr-kpis-4">' +
      prKpi('EPF', dash || inr(t.epf), 'Employee provident fund stored on the run.') +
      prKpi('ESI', dash || inr(t.esi), 'Sum of employee ESI where ESI applies. Not applicable is omitted, not treated as ₹0.') +
      prKpi('Professional tax', dash || inr(t.pt), 'Professional tax where it is configured on the employee.') +
      prKpi('TDS', dash || inr(t.tds), 'Tax deducted at source stored on the run. Not a filing.') +
      '</div></div><div class="pr-band"><p class="pr-kicker">Employer contributions</p><div class="pr-kpis pr-kpis-2">' +
      prKpi('EPF employer', dash || inr(t.epfEr), 'Employer contribution stored on the run. Not part of net pay.') +
      prKpi('ESI employer', dash || inr(t.esiEr), 'Employer ESI where configured. Not a challan payment.') +
      '</div></div>' +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Statutory status</h2><span class="card-sub">' + esc(run.monthLabel) + ' · ' + esc(run.id) + ' · ' + esc(prRange(run)) + '</span></div>' + prExportBtn('statutory', 'Export') + '</div><div class="card-body">' +
      '<div class="row wrap" style="gap:8px">' + badge('Calculated', 'info', 'nodot') + badge('Filing not recorded', 'neutral', 'nodot') + badge('Payment not recorded', 'neutral', 'nodot') + badge('Labour welfare fund · Not configured', 'warning', 'nodot') + '</div>' +
      (t.empty ? '' : '<div class="pr-sum" style="margin-top:12px"><div><span>Employee statutory</span><b>' + inr(ee) + '</b></div><div><span>Total deductions</span><b>' + inr(t.ded) + '</b></div></div><p class="xs muted">Statutory is EPF, ESI, professional tax and TDS. Total deductions also include loss of pay ' + inr(t.lop) + ' and other deductions ' + inr(t.otherD) + '.</p>') +
      '</div>' +
      '<div class="tbl-wrap"><table class="tbl" data-pr="1" style="min-width:1100px"><thead><tr><th>Employee</th><th>Department</th><th class="right">Basic (basis)</th><th class="right">EPF employee</th><th class="right">EPF employer</th><th class="right">ESI employee</th><th class="right">ESI employer</th><th class="right">PT</th><th class="right">TDS</th><th class="right">Employee statutory</th></tr></thead><tbody>' +
      (run.lines || []).map(prLine).map(l => {
        if (l.blocked) return '<tr><td>' + esc(l.name) + '</td><td>' + esc(prDeptName(l.dept)) + '</td><td colspan="8"><span class="pr-na">Not calculated — missing salary structure</span></td></tr>';
        if (l.included === false) return '<tr><td>' + esc(l.name) + '</td><td>' + esc(prDeptName(l.dept)) + '</td><td colspan="8"><span class="pr-na">Excluded' + (l.excludeReason ? ' · ' + esc(l.excludeReason) : '') + '</span></td></tr>';
        const stat = prNum(l.epf) + prNum(l.esi) + prNum(l.pt) + prNum(l.tds);
        return '<tr><td><span class="pr-name">' + esc(l.name) + '</span><div class="xs muted mono">' + esc(l.id) + '</div></td><td>' + esc(prDeptName(l.dept)) + '</td><td class="right tnum">' + inr(l.basic) + '</td><td class="right">' + prCell(l.epf) + '</td><td class="right">' + prCell(l.epfEr) + '</td><td class="right">' + prCell(l.esi, 'Not applicable') + '</td><td class="right">' + prCell(l.esi == null ? null : l.esiEr, 'Not applicable') + '</td><td class="right">' + prCell(l.pt) + '</td><td class="right">' + prCell(l.tds) + '</td><td class="right tnum">' + inr(stat) + '</td></tr>';
      }).join('') +
      '</tbody><tfoot><tr><th colspan="2">Total included</th><td class="right tnum">' + inr(t.basic) + '</td><td class="right tnum">' + inr(t.epf) + '</td><td class="right tnum">' + inr(t.epfEr) + '</td><td class="right tnum">' + inr(t.esi) + '</td><td class="right tnum">' + inr(t.esiEr) + '</td><td class="right tnum">' + inr(t.pt) + '</td><td class="right tnum">' + inr(t.tds) + '</td><th class="right tnum">' + inr(ee) + '</th></tr></tfoot></table></div>' +
      '<div class="card-foot">Stored results for this pay run. Rates are not recalculated here, and no filing or authority payment is recorded.</div></section>';
  }

  function prDept(run) {
    const lines = prActive(run);
    const rows = prByDept(lines);
    const t = prTotals(lines);
    return prWarn(prQuality(run)) +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Department comparison</h2><span class="card-sub">Net payroll payable</span></div></div><div class="card-body">' +
      (t.empty ? '<p class="small muted">No included employees.</p>' : prBars(rows, 'net', { money: true, head: true, share: t.net, act: 'prDrill' })) + '</div></section>' +
      '<section class="card"><div class="card-head"><h2 class="card-title">Department payroll</h2>' + qmark('Average salary is net payroll payable divided by headcount. Overtime is approved timesheet hours. No overtime cost is stored.') + '</div>' +
      '<div class="tbl-wrap"><table class="tbl" data-pr="1"><thead><tr><th>Department</th><th class="right">Headcount</th><th class="right">Gross payroll</th><th class="right">Total deductions</th><th class="right">Net payroll payable</th><th class="right" title="Net payroll payable ÷ headcount. Not gross pay.">Average salary</th><th class="right" title="Approved timesheet hours. Cost is not stored.">Overtime hours</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(d => '<tr class="pr-click" data-row="prDrill" data-id="' + esc(d.id) + '"><td class="medium">' + esc(d.name) + '</td><td class="right tnum">' + d.n + '</td><td class="right tnum">' + inr(d.gross) + '</td><td class="right tnum">' + inr(d.ded) + '</td><td class="right tnum">' + inr(d.net) + '</td><td class="right tnum">' + inr(Math.round(d.net / d.n)) + '</td><td class="right tnum">' + d.ot + '</td><td>' + btn('Employees', { act: 'prDrill', a: d.id, cls: 'btn-xs' }) + '</td></tr>').join('') : '<tr><td colspan="8"><span class="pr-na">No department totals — nobody is included.</span></td></tr>') +
      '</tbody>' + (t.empty ? '' : '<tfoot><tr><th>All departments</th><td class="right tnum">' + t.n + '</td><td class="right tnum">' + inr(t.gross) + '</td><td class="right tnum">' + inr(t.ded) + '</td><th class="right tnum">' + inr(t.net) + '</th><td class="right tnum">' + inr(Math.round(t.net / t.n)) + '</td><td class="right tnum">' + t.ot + '</td><td></td></tr></tfoot>') +
      '</table></div></section>';
  }

  function prMom(delta, absKey, pctKey) {
    if (!delta) return '<span class="pr-na">First finalized month</span>';
    const abs = delta[absKey], pct = delta[pctKey];
    const sign = abs > 0 ? '+' : abs < 0 ? '−' : '';
    return '<span class="tnum">' + sign + inr(Math.abs(abs)) + ' · ' + sign + Math.abs(pct).toFixed(1) + '%</span>';
  }
  function prTrendChart(series) {
    const max = series.reduce((m, r) => Math.max(m, r.gross || 0, r.ded || 0, r.net || 0), 0) || 1;
    const h = v => (v ? Math.max(2, Math.round(v / max * 100)) : 0);
    return '<div class="pr-legend"><span><i class="g"></i>Gross payroll</span><span><i class="d"></i>Deductions</span><span><i class="n"></i>Net payable</span></div>' +
      '<div class="pr-cols" role="group" aria-label="Monthly payroll">' + series.map(r => {
        const on = S.ui.pr.runId === r.runId;
        const short = String(r.name).replace(/\s+\d{4}$/, '');
        return '<button type="button" class="pr-col' + (on ? ' is-on' : '') + '" data-act="prTrendPick" data-a="' + esc(r.runId) + '" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + esc(r.name + '. Gross ' + inr(r.gross) + ', deductions ' + inr(r.ded) + ', net ' + inr(r.net)) + '"><span class="pr-col-bars" aria-hidden="true"><span class="g" style="height:' + h(r.gross) + '%"></span><span class="d" style="height:' + h(r.ded) + '%"></span><span class="n" style="height:' + h(r.net) + '%"></span></span><span class="pr-col-name">' + esc(short) + '</span></button>';
      }).join('') + '</div>';
  }
  function prTrends(selected) {
    const all = prRuns().slice().sort((a, b) => a.periodEnd.localeCompare(b.periodEnd) || a.id.localeCompare(b.id));
    const hist = S.ui.pr.preview === 'nohistory' ? [] : all;
    const latest = prLatest(hist);
    const series = prMonthSeries(hist);
    const newer = latest ? hist.filter(r => r.periodEnd > latest.periodEnd && !prClosed(r)) : [];
    const note = !hist.length
      ? alertBox('info', 'info', '<span>No payroll history. There is no finalized run to total.</span>')
      : latest ? '' : alertBox('warning', 'alert', '<span>Runs exist, but none are finalized or paid. There is no payout to chart.</span>');
    const last = series[series.length - 1];
    const summary = last
      ? '<div class="pr-sum"><div><span>Latest finalized · ' + esc(last.name) + '</span><b>' + inr(last.net) + '</b></div><div><span>Month-over-month net</span><b>' + prMom(last.delta, 'net', 'netPct') + '</b></div><div><span>Employees in run</span><b>' + last.n + '</b></div></div>'
      : '';
    const focus = selected && series.find(s => s.runId === selected.id);
    const same = focus && last && focus.month === last.month;
    const focusBody = !focus
      ? '<p class="xs muted">Select a month to open that pay run.</p>'
      : (same ? '' : '<div class="pr-sum"><div><span>' + esc(focus.name) + '</span><b>' + inr(focus.net) + '</b></div><div><span>Gross payroll</span><b>' + inr(focus.gross) + '</b></div><div><span>Total deductions</span><b>' + inr(focus.ded) + '</b></div><div><span>Employees</span><b>' + focus.n + '</b></div></div>') +
        '<p class="small">Net ' + prMom(focus.delta, 'net', 'netPct') + ' · Gross ' + prMom(focus.delta, 'gross', 'grossPct') + ' · Deductions ' + prMom(focus.delta, 'ded', 'dedPct') + '</p>' +
        '<div class="row wrap">' + btn('Open this pay run', { act: 'prOpen', a: focus.runId, cls: 'btn-sm btn-primary' }) + btn('Salary register', { act: 'prPick', a: focus.runId, cls: 'btn-sm' }) + '</div>';
    const aside = series.length
      ? '<p class="xs muted">' + (newer.length ? esc(newer.map(r => r.monthLabel + ' is ' + PR_STATUS[r.status][0]).join('. ')) + '. ' : '') + 'Draft and rejected runs stay in the table and are left out of the chart.</p>'
      : '';
    const st = S.ui.pr.trendStatus;
    const rows = hist.filter(r => !st || r.status === st);
    return note +
      (series.length ? '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Payroll trend</h2><span class="card-sub">One total per month. Closed runs only.</span></div></div><div class="card-body">' +
        summary + prTrendChart(series) + '<div class="pr-trend-foot">' + focusBody + aside + '</div>' +
        '<table class="sr-only"><caption>Finalized payroll by month</caption><thead><tr><th>Month</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Employees</th><th>Status</th></tr></thead><tbody>' +
        series.map(s => '<tr><th>' + esc(s.name) + '</th><td>' + inr(s.gross) + '</td><td>' + inr(s.ded) + '</td><td>' + inr(s.net) + '</td><td>' + s.n + '</td><td>' + esc(PR_STATUS[s.status][0]) + '</td></tr>').join('') +
        '</tbody></table></div></section>' : '') +
      '<section class="card"><div class="card-head"><h2 class="card-title">Payroll history</h2><span class="grow"></span>' +
      sel('pr-tst', 'ui.pr.trendStatus', st, [['', 'All statuses'], ['draft', 'Draft'], ['review', 'Under Review'], ['approved', 'Approved'], ['finalized', 'Finalized'], ['paid', 'Paid'], ['rejected', 'Rejected']], { style: 'width:auto', aria: 'Run status' }) +
      '</div><div class="tbl-wrap"><table class="tbl" data-pr="1" style="min-width:1080px"><thead><tr><th>Payroll period</th><th>Run ID</th><th>Status</th><th class="right">Employees</th><th class="right">Gross payroll</th><th class="right">Total deductions</th><th class="right">Net payroll payable</th><th>Processed</th><th>In month total</th><th></th></tr></thead><tbody>' +
      (rows.length ? rows.map(r => {
        const t = prTotals(prActive(r));
        const inTot = prClosed(r);
        const cur = selected && selected.id === r.id;
        const when = r.processed ? esc(prDay(r.processed, true)) : '<span class="pr-na">—</span>';
        return '<tr class="pr-st pr-st-' + esc(r.status) + (cur ? ' is-on' : '') + '"><td>' + esc(r.monthLabel) + '<div class="xs muted">' + esc(prRange(r)) + '</div></td><td class="mono">' + esc(r.id) + '</td><td>' + prStatusBadge(r.status) + '</td><td class="right tnum">' + (t.empty ? '—' : t.n) + '</td><td class="right">' + prMoneyOrPending(r, t.gross) + '</td><td class="right">' + prMoneyOrPending(r, t.ded) + '</td><td class="right">' + prMoneyOrPending(r, t.net) + '</td><td class="tnum"' + (r.paidOn ? ' title="Payment recorded ' + esc(prDay(r.paidOn, true)) + '"' : '') + '>' + when + '</td><td>' + (inTot ? badge('Included', 'success', 'nodot') : badge('Excluded', 'neutral', 'nodot')) + '</td><td>' + btn('Open', { act: 'prOpen', a: r.id, cls: 'btn-xs' }) + '</td></tr>';
      }).join('') : '<tr><td colspan="10"><span class="pr-na">No runs for this status.</span></td></tr>') +
      '</tbody></table></div><div class="card-foot">Included months are finalized or paid. Draft and rejected runs are not added into a month.</div></section>';
  }

  function prWizard(cur) {
    const order = [['form', 'Period'], ['select', 'Employees'], ['salary', 'Salary'], ['review', 'Review'], ['approve', 'Approval'], ['final', 'Finalize']];
    const i = order.findIndex(s => s[0] === (cur === 'done' ? 'final' : cur));
    return '<ol class="pr-steps" aria-label="New pay run">' + order.map((s, n) =>
      '<li class="' + (n < i ? 'done' : n === i ? 'cur' : '') + '"' + (n === i ? ' aria-current="step"' : '') + '><span>' + (n + 1) + '</span>' + esc(s[1]) + '</li>'
    ).join('') + '</ol>';
  }
  function prFoot(left, right) {
    return '<div class="row wrap pr-foot">' + (left || '<span></span>') + '<div class="row wrap">' + (right || '') + '</div></div>';
  }
  function prRunMeta(run) {
    return '<p class="small muted" style="margin:0 0 12px">' + esc(run.id) + ' · ' + esc(run.monthLabel) + ' · ' + esc(run.periodStart) + ' – ' + esc(run.periodEnd) + ' · ' + esc(PR_STATUS[run.status][0]) + ' · ' + (prMode() === 'single' ? 'Single-level approval' : 'Maker–checker') + ' · Basis ' + (run.basis === 'annual' ? 'Annual CTC' : 'Monthly gross') + '</p>';
  }
  function prPickLines(lines) {
    const q = String(S.ui.pr.pickQ || '').trim().toLowerCase();
    const dept = S.ui.pr.pickDept;
    return lines.filter(l => {
      if (dept && prDeptId(l.dept) !== dept) return false;
      if (!q) return true;
      return (l.name + ' ' + l.id + ' ' + prDeptName(l.dept)).toLowerCase().indexOf(q) >= 0;
    });
  }
  function prFormError(ym) {
    if (!ym) return 'Choose the payroll month.';
    if (!/^\d{4}-\d{2}$/.test(ym) || !prPeriodEnd(ym)) return 'Enter a valid month.';
    const clash = prClash(prRuns(), ym);
    if (clash) return prMonthLabel(ym) + ' already has ' + clash.id + ' (' + PR_STATUS[clash.status][0] + ').';
    return '';
  }
  function prHist(run) {
    return '<section class="card"><div class="card-head"><h2 class="card-title">Approval history</h2></div><div class="card-body"><ul class="small" style="margin:0;padding-left:18px">' +
      ((run.history || []).length ? run.history.map(h => '<li><b>' + esc(h.at) + '</b> · ' + esc(h.who) + ' — ' + esc(h.text) + '</li>').join('') : '<li>No approval actions yet.</li>') +
      '</ul></div></section>';
  }
  function vPayruns() {
    prEnsure();
    const step = S.ui.pr.step || '';
    const titles = {
      form: ['New pay run', 'Set the payroll period. Creating a run does not calculate pay and does not transfer salaries.'],
      select: ['Select employees', 'Choose who is included. People without a salary structure stay on the list.'],
      salary: ['Salary input', 'Choose annual CTC or monthly gross, then review each structure.'],
      review: ['Payroll review', 'Calculate payroll, then check earnings, deductions and net pay. Nothing is paid here.'],
      approve: ['Approval', 'Approve, or reject with a reason. Approval does not generate payslips and does not transfer salaries.'],
      final: ['Finalize payroll', 'Finalizing generates payslips. It does not start a bank transfer.'],
      done: ['Pay run', 'This run is locked. Paid amount appears only after finance confirms an external payment.']
    };
    const head = titles[step] || ['Payroll', 'Open a pay run, or create the next one. Payroll reports stay on their own screen.'];
    const run = step && step !== 'form' ? prRun() : null;
    let body = prDash();
    if (step === 'form') body = prForm();
    else if (step && !run) body = prDash();
    else if (step === 'select') body = prSelect(run);
    else if (step === 'salary') body = prSalary(run);
    else if (step === 'review') body = prReview(run);
    else if (step === 'approve') body = prApprove(run);
    else if (step === 'final' || step === 'done') body = prFinal(run);
    const actions = btn('Payroll reports', { act: 'go', a: '#/payroll', cls: step ? '' : 'btn-primary', icon: 'pie' }) +
      (step ? btn('All pay runs', { act: 'prDash', icon: 'cash' }) : '');
    const role = prActor() === 'viewer' ? alertBox('warning', 'alert', '<span>You can view payroll. Creating and editing need HR, Admin or Maker. Approval needs the checker in maker–checker, or HR or Admin in single-level.</span>') : '';
    return '<div class="page">' + pageHead(head[0], head[1], actions) + role + prControls('') + body + '</div>';
  }
  function prDash() {
    const can = prCan('create');
    return '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Pay runs</h2><span class="card-sub">Statuses stay on the run. Rejected runs are kept. Create new pay run starts a period — it does not open reports.</span></div>' +
      (can ? btn('Create new pay run', { act: 'prCreate', cls: 'btn-primary', icon: 'plus' }) : '') +
      '</div><div class="tbl-wrap"><table class="tbl" data-pr="1" style="min-width:980px"><thead><tr><th>Period</th><th>Run</th><th>Status</th><th class="right">Employees</th><th class="right">Net payroll payable</th><th>Paid amount</th><th></th></tr></thead><tbody>' +
      prRuns().map(r => {
        const t = prTotals(prActive(r));
        return '<tr><td>' + esc(r.monthLabel) + '<div class="xs muted">' + esc(r.periodStart) + ' – ' + esc(r.periodEnd) + '</div></td><td class="mono">' + esc(r.id) + '</td><td>' + prStatusBadge(r.status) + '</td><td class="right tnum">' + (t.empty ? '—' : t.n) + '</td><td class="right">' + prMoneyOrPending(r, t.net) + '</td><td>' + (r.status === 'paid' && !t.empty ? '<span class="tnum">' + inr(t.net) + '</span>' : '<span class="pr-na">Not recorded</span>') + '</td><td>' + btn('Open', { act: 'prOpen', a: r.id, cls: 'btn-xs btn-primary' }) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }
  function prForm() {
    const ym = S.ui.pr.formMonth || '';
    const err = S.ui.pr.formTried ? prFormError(ym) : '';
    const end = prPeriodEnd(ym);
    return prWizard('form') + '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Payroll period</h2><span class="card-sub">Required fields are marked. A month that already has an open, approved, finalized or paid run cannot be created again.</span></div></div><div class="card-body">' +
      formLegend() + '<div class="row wrap" style="gap:16px;align-items:flex-start">' +
      field('Payroll month', inp('pr-month', 'ui.pr.formMonth', ym, { type: 'month', live: 'change', req: true, err: !!err }), { for: 'pr-month', req: true, err: err, help: 'The month this pay run covers.' }) +
      field('Period start', '<input class="input" id="pr-start" readonly value="' + esc(ym ? ym + '-01' : '') + '" aria-required="true">', { for: 'pr-start', req: true }) +
      field('Period end', '<input class="input" id="pr-end" readonly value="' + esc(end) + '" aria-required="true">', { for: 'pr-end', req: true }) +
      '</div>' + prFoot(btn('Back', { act: 'prDash' }), btn('Continue to employees', { act: 'prFormSave', cls: 'btn-primary' })) +
      '</div></section>';
  }
  function prTick(run, l, editable) {
    const on = !l.blocked && l.included !== false;
    return '<button type="button" class="pr-tick" aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + (on ? 'Exclude ' : 'Include ') + esc(l.name) + '" data-act="prToggle" data-a="' + esc(l.id) + '"' + (!editable || l.blocked ? ' disabled' : '') + '>' + ic('check', 12, 2.4) + '</button>';
  }
  function prSelect(run) {
    const editable = prCan('edit', run);
    const lines = (run.lines || []).map(prLine);
    const shown = prPickLines(lines);
    const eligible = shown.filter(l => !l.blocked && l.included !== false);
    const excluded = shown.filter(l => l.blocked || l.included === false);
    const selected = lines.filter(l => !l.blocked && l.included !== false).length;
    const depts = [['', 'All departments']].concat(Object.keys(PR_DEPT).map(id => [id, PR_DEPT[id]]));
    const reason = l => l.blocked
      ? '<span class="pr-na">' + esc(l.blocked === 'statutory-pending' ? 'Statutory not calculated' : 'Missing salary structure') + '</span>'
      : (editable
        ? sel('ex-' + l.id, 'data.payruns.#' + run.id + '.lines.#' + l.id + '.excludeReason', l.excludeReason || '', [['', 'Included'], ['On leave', 'On leave'], ['Joined after cutoff', 'Joined after cutoff'], ['Salary on hold', 'Salary on hold']], { style: 'width:auto', aria: 'Exclusion reason for ' + l.name })
        : '<span class="small">' + esc(l.excludeReason || (l.included === false ? 'Excluded' : 'Included')) + '</span>');
    const row = l => '<tr><td>' + prTick(run, l, editable) + '</td><td><span class="pr-name">' + esc(l.name) + '</span></td><td class="mono">' + esc(l.id) + '</td><td>' + esc(prDeptName(l.dept)) + '</td><td>' + (l.blocked ? badge('Not eligible', 'warning') : l.included === false ? badge('Excluded', 'neutral') : badge('Eligible', 'success', 'nodot')) + '</td><td>' + reason(l) + '</td></tr>';
    const table = (list, empty) => list.length
      ? '<div class="tbl-wrap"><table class="tbl" data-pr="1" style="min-width:860px"><thead><tr><th></th><th>Employee</th><th>Employee ID</th><th>Department</th><th>Eligibility</th><th>Exclusion reason</th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>'
      : '<p class="small muted" style="padding:0 20px 16px">' + empty + '</p>';
    return prWizard('select') + prRunMeta(run) +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Who is in this run</h2><span class="card-sub">' + selected + ' selected. Select all eligible skips anyone without a salary structure.</span></div>' +
      (editable ? btn('Select all eligible', { act: 'prSelectEligible', cls: 'btn-sm' }) : '') + '</div>' +
      '<div class="toolbar"><label class="search">' + ic('search', 16) + '<input type="search" id="pr-pick" data-model="ui.pr.pickQ" data-live="input" value="' + esc(S.ui.pr.pickQ || '') + '" placeholder="Name, ID or department" aria-label="Search employees"></label>' +
      sel('pr-pdept', 'ui.pr.pickDept', S.ui.pr.pickDept || '', depts, { style: 'width:auto', aria: 'Department' }) + '</div>' +
      (shown.length ? '<h3 class="section-t" style="padding:0 20px">Eligible employees</h3>' + table(eligible, 'No eligible employees match.') + '<h3 class="section-t" style="padding:8px 20px 0">Excluded</h3>' + table(excluded, 'Nobody matching this search is excluded.') : emptyState('No matching employees', 'Try another name or department.', '', 'neutral')) +
      '<div class="card-body">' + prFoot(btn('All pay runs', { act: 'prDash' }), btn('Continue to salary', { act: 'prTo', a: 'salary', cls: 'btn-primary' })) + '</div></section>';
  }
  function prSalary(run) {
    const editable = prCan('edit', run);
    const basis = run.basis === 'annual' ? 'annual' : 'monthly';
    const lines = (run.lines || []).map(prLine);
    const cards = lines.map(l => {
      if (l.blocked && l.blocked !== 'statutory-pending') {
        const f = S.ui.pr.struct || {};
        return '<article class="pr-emp"><header><span class="pr-name">' + esc(l.name) + '</span><span class="mono xs">' + esc(l.id) + '</span>' + badge('Missing salary', 'warning') + '</header>' +
          alertBox('warning', 'alert', '<span>' + esc(l.detail || 'No salary structure is on file.') + ' This employee is not skipped silently and is not included.</span>') +
          (editable ? '<div class="row wrap" style="gap:12px">' +
            field('Basic', inp('sb', 'ui.pr.struct.basic', f.basic == null ? '' : f.basic, { type: 'number', min: 0, attrs: 'data-num', live: 'change' }), { for: 'sb', req: true }) +
            field('HRA', inp('sh', 'ui.pr.struct.hra', f.hra == null ? '' : f.hra, { type: 'number', min: 0, attrs: 'data-num', live: 'change' }), { for: 'sh' }) +
            field('Special allowance', inp('ss', 'ui.pr.struct.special', f.special == null ? '' : f.special, { type: 'number', min: 0, attrs: 'data-num', live: 'change' }), { for: 'ss' }) +
            '</div>' +             btn('Save earnings', { act: 'prSaveStructure', a: l.id, cls: 'btn-sm' }) +
            '<p class="xs muted">EPF, ESI, professional tax and TDS are not calculated in this prototype, so this employee stays excluded after earnings are saved.</p>' : '') +
          '</article>';
      }
      const gross = prEarnings(l);
      const annual = prAnnualCtc(l);
      const ex = [];
      if (l.lop) ex.push('Loss of pay ' + inr(l.lop));
      if (l.esi == null) ex.push('ESI not applicable');
      if (l.ctcEdited) ex.push('Earnings were scaled. Statutory amounts were not recomputed.');
      if (l.blocked === 'statutory-pending') ex.push('Statutory deductions are not configured. Still excluded.');
      if (l.included === false && !l.blocked) ex.push('Excluded' + (l.excludeReason ? ' · ' + l.excludeReason : ''));
      const edit = S.ui.pr.edit || {};
      const shown = edit[l.id] != null && edit[l.id] !== '' ? edit[l.id] : (basis === 'annual' ? annual : gross);
      return '<article class="pr-emp"><header><span class="pr-name">' + esc(l.name) + '</span><span class="mono xs">' + esc(l.id) + ' · ' + esc(prDeptName(l.dept)) + '</span>' +
        (l.included === false || l.blocked ? badge('Not in run', 'neutral') : badge('In run', 'success', 'nodot')) + '</header>' +
        '<p class="small" style="margin:0">Basic ' + inr(l.basic) + ' · HRA ' + inr(l.hra) + ' · Special ' + inr(l.special) + ' · Other ' + inr(l.otherE) + ' · Monthly gross <b>' + inr(gross) + '</b> · Annual CTC <b>' + (annual == null ? '—' : inr(annual)) + '</b></p>' +
        (ex.length ? '<p class="small" style="margin:6px 0 0">' + ex.map(esc).join(' · ') + '</p>' : '') +
        (editable && !l.blocked ? '<div class="row wrap" style="gap:8px;align-items:flex-end;margin-top:8px">' +
          field(basis === 'annual' ? 'Annual CTC' : 'Monthly gross', inp('pay-' + l.id, 'ui.pr.edit.' + l.id, shown, { type: 'number', min: 0, attrs: 'data-num', live: 'change' }), { for: 'pay-' + l.id, help: basis === 'annual' ? 'Yearly CTC, including employer EPF and ESI.' : 'Monthly earnings before deductions.' }) +
          btn('Apply', { act: 'prApplyPay', a: l.id, cls: 'btn-sm' }) + '</div>' : '') +
        '</article>';
    }).join('');
    return prWizard('salary') + prRunMeta(run) +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Salary basis</h2><span class="card-sub">Annual CTC = (monthly earnings + employer EPF + employer ESI) × 12. Monthly gross = basic + HRA + special allowance + other earnings. Switching basis does not recalculate statutory deductions.</span></div></div><div class="card-body">' +
      '<div class="radio-cards" role="radiogroup" aria-label="Salary calculation basis">' +
      [['monthly', 'Monthly gross', 'Use the monthly earnings already on the structure.'], ['annual', 'Annual CTC', 'Enter a yearly CTC. Monthly earnings scale to match. Statutory amounts stay as stored.']].map(([v, label, help]) =>
        '<label class="radio-card"><input type="radio" name="pr-basis" value="' + v + '" data-model="data.payruns.#' + run.id + '.basis" data-live="change"' + (basis === v ? ' checked' : '') + (editable ? '' : ' disabled') + '><span class="col"><span class="medium">' + label + '</span><span class="xs muted">' + help + '</span></span></label>'
      ).join('') + '</div></div></section>' +
      '<div class="pr-emp-list">' + cards + '</div>' +
      prFoot(btn('Back to employees', { act: 'prTo', a: 'select' }), btn('Continue to calculation', { act: 'prTo', a: 'review', cls: 'btn-primary' }));
  }
  function prReview(run) {
    const editable = prCan('edit', run);
    const ready = prIsCalc(run);
    const lines = prActive(run);
    const t = prTotals(lines);
    const rows = ready ? lines.map(l => '<tr><td><span class="pr-name">' + esc(l.name) + '</span><div class="xs muted mono">' + esc(l.id) + '</div></td><td>' + esc(prDeptName(l.dept)) + '</td><td class="right tnum">' + inr(l.basic) + '</td><td class="right tnum">' + inr(l.hra) + '</td><td class="right tnum">' + inr(l.special) + '</td><td class="right tnum">' + inr(l.otherE) + '</td><td class="right tnum">' + inr(l.gross) + '</td><td class="right tnum">' + inr(prNum(l.epf) + prNum(l.esi) + prNum(l.pt) + prNum(l.tds) + prNum(l.otherD)) + '</td><td class="right">' +
      (editable ? '<div style="width:110px;margin-left:auto">' + inp('lop-' + l.id, 'data.payruns.#' + run.id + '.lines.#' + l.id + '.lop', l.lop, { type: 'number', min: 0, attrs: 'data-num', live: 'change' }) + '</div>' : '<span class="tnum">' + inr(l.lop) + '</span>') +
      '</td><td class="right tnum">' + inr(l.ded) + '</td><td class="right tnum">' + inr(l.net) + '</td><td>' + btn('Details', { act: 'prEmp', a: l.id, cls: 'btn-xs' }) + '</td></tr>').join('') : '';
    const submitLabel = run.status === 'rejected' ? 'Resubmit for review' : 'Submit for review';
    const next = prMode() === 'single'
      ? btn('Continue to approval', { act: 'prTo', a: 'approve', cls: 'btn-primary' })
      : (prCan('submit', run) ? btn(submitLabel, { act: 'prSubmit', cls: 'btn-primary' }) : btn('Approval status', { act: 'prTo', a: 'approve' }));
    return prWizard('review') + prRunMeta(run) + prContext(run) +
      (ready ? '' : alertBox('info', 'info', '<span>Payroll is not calculated yet. Calculate it before review. Calculating does not submit the run and does not pay anyone.</span>')) +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Calculation</h2><span class="card-sub">' + (ready ? 'Calculated ' + esc(run.calculatedAt) + '. Loss of pay can be corrected. Statutory rates are not recalculated here.' : 'Uses the salary structures and the employees you selected.') + '</span></div><div class="row wrap">' +
      (prCan('calc', run) ? btn(ready ? 'Recalculate' : 'Calculate payroll', { act: 'prRecalc', cls: 'btn-primary btn-sm', icon: 'refresh' }) : '') +
      '</div></div>' + (ready ? '<div class="card-body">' + prSumStrip(t) + '</div><div class="tbl-wrap"><table class="tbl" data-pr="1" style="min-width:1280px"><thead><tr><th>Employee</th><th>Department</th><th class="right">Basic</th><th class="right">HRA</th><th class="right">Special</th><th class="right">Other earnings</th><th class="right">Gross salary</th><th class="right">Statutory and other</th><th class="right">LOP</th><th class="right">Total deductions</th><th class="right">Net pay</th><th></th></tr></thead><tbody>' +
        rows + '</tbody><tfoot><tr><th colspan="6">Total · ' + t.n + ' employees</th><td class="right tnum">' + inr(t.gross) + '</td><td></td><td class="right tnum">' + inr(t.lop) + '</td><td class="right tnum">' + inr(t.ded) + '</td><th class="right tnum">' + inr(t.net) + '</th><td></td></tr></tfoot></table></div>' : '<div class="card-body"><p class="small muted">Selected employees: ' + lines.length + '. Excluded or missing salary: ' + (run.lines.length - lines.length) + '.</p></div>') +
      '<div class="card-body">' + prFoot(btn('Back to salary', { act: 'prTo', a: 'salary' }), ready ? next : '') + '</div></section>' + prHist(run);
  }
  function prApprove(run) {
    const waiting = prMode() === 'maker' && run.status === 'draft';
    const note = prCan('approve', run)
      ? ''
      : alertBox('info', 'info', '<span>' + (prMode() === 'single'
        ? 'HR or Admin approves this draft. Maker and Checker do not approve in single-level setup.'
        : (run.status === 'review' ? 'The checker approves or rejects. The maker cannot approve a run they can still edit.' : 'Submit the calculated run before anyone can approve it.')) + '</span>');
    return prWizard('approve') + prRunMeta(run) + prContext(run) + note +
      '<section class="card"><div class="card-head"><h2 class="card-title">' + esc(PR_STATUS[run.status][0]) + '</h2></div><div class="card-body">' + prSummaryHtml(run) +
      '<div class="row wrap" style="margin-top:12px">' +
      (prCan('approve', run) ? btn('Approve', { act: 'prApprove', cls: 'btn-primary', icon: 'check' }) : '') +
      (prCan('reject', run) ? btn('Reject and return to maker', { act: 'prRejectOpen' }) : '') +
      (waiting ? btn('Back to review', { act: 'prTo', a: 'review' }) : '') +
      '</div></div></section>' + prHist(run);
  }
  function prFinal(run) {
    const slips = (run.lines || []).filter(l => l.payslip);
    const lock = run.status === 'paid'
      ? alertBox('success', 'checkCircle', '<span>Paid amount is recorded. The run is locked. APTCORE did not send the bank transfer.</span>')
      : (run.status === 'finalized'
        ? alertBox('info', 'lock', '<span>Finalized payroll. Payslips are generated. Paid amount is not recorded until finance confirms the transfer outside APTCORE.</span>')
        : '');
    return prWizard(prClosed(run) ? 'done' : 'final') + prRunMeta(run) + lock + prContext(run) +
      '<section class="card"><div class="card-head"><div class="col"><h2 class="card-title">Final confirmation</h2><span class="card-sub">Check the period, the people included and the approval before generating payslips.</span></div></div><div class="card-body">' +
      prSummaryHtml(run) +
      '<div class="row wrap" style="margin-top:12px">' +
      (prCan('finalize', run) ? btn('Finalize and generate payslips', { act: 'prFinalize', cls: 'btn-primary', icon: 'fileCheck' }) : '') +
      (prCan('paid', run) ? btn('Record external payment', { act: 'prPaid', icon: 'check' }) : '') +
      (!prClosed(run) ? btn('Back to approval', { act: 'prTo', a: 'approve' }) : '') +
      '</div></div></section>' +
      '<section class="card"><div class="card-head"><h2 class="card-title">Payslips</h2><span class="card-sub">' + (slips.length ? slips.length + ' generated. A payslip is not a payment receipt.' : 'None yet. Finalizing creates them.') + '</span></div><div class="card-body">' +
      (slips.length ? '<ul class="small" style="margin:0;padding-left:18px">' + slips.map(l => '<li>' + esc(l.name) + ' · net pay ' + inr(prLine(l).net) + ' · ' + btn('View', { act: 'prEmp', a: l.id, cls: 'btn-xs' }) + '</li>').join('') + '</ul>' : '<p class="small muted" style="margin:0">Payslips are created when this run is finalized.</p>') +
      '</div></section>' + prHist(run);
  }

  function dPay(d) {
    const run = prRun(d.run) || prRun();
    const raw = run && (run.lines || []).find(l => l.id === d.id);
    if (!run || !raw) return '';
    const l = prLine(raw);
    const body = l.blocked
      ? alertBox('warning', 'alert', '<span>' + esc(l.detail) + '</span>') + '<p class="small">Open the employee salary profile, add a structure, then recalculate this run. The employee stays visible so the skip is not silent.</p>'
      : '<div class="pr-sum"><div><span>Gross salary</span><b>' + inr(l.gross) + '</b></div><div><span>Total deductions</span><b>' + inr(l.ded) + '</b></div><div><span>Net pay</span><b>' + inr(l.net) + '</b></div></div>' +
        '<p class="small muted">Net pay = basic + HRA + special allowance + other earnings − EPF − ESI − PT − TDS − loss of pay − other deductions.</p>' +
        '<div class="tbl-wrap"><table class="tbl" data-pr="1"><thead><tr><th>Component</th><th class="right">Amount</th><th>Meaning</th></tr></thead><tbody>' +
        [['Basic', l.basic, 'Earning'], ['HRA', l.hra, 'Earning'], ['Special allowance', l.special, 'Earning'], ['Other earnings', l.otherE, 'Earning'], ['Gross salary', l.gross, 'Sum of earnings'],
          ['EPF', l.epf, 'Employee deduction'], ['ESI', l.esi, l.esi == null ? 'Not applicable' : 'Employee deduction'], ['Professional tax', l.pt, 'Employee deduction'], ['TDS', l.tds, 'Employee deduction'],
          ['Loss of pay', l.lop, l.lop === 0 ? 'No loss of pay this period' : 'Employee deduction'], ['Other deductions', l.otherD, 'Employee deduction'], ['Employer EPF', l.epfEr, 'Not in net pay'], ['Employer ESI', l.esi == null ? null : l.esiEr, 'Not in net pay']
        ].map(row => '<tr><td>' + esc(row[0]) + '</td><td class="right">' + (row[1] == null ? prCell(null, 'Not applicable') : '<span class="tnum">' + inr(row[1]) + '</span>') + '</td><td class="small muted">' + esc(row[2]) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<p class="small">Overtime hours: <b>' + prNum(l.ot) + '</b>. Hours only — no overtime cost is stored. ' + (l.payslip ? 'Payslip generated when the run was finalized. This is not a bank receipt.' : 'Payslip is created when this run is finalized.') + '</p>';
    return dhead(esc(l.name), esc(l.id) + ' · ' + esc(prDeptName(l.dept)) + ' · ' + esc(run.monthLabel)) + '<div class="drawer-body" data-keep-scroll style="padding:16px 20px 28px">' + body + '</div>';
  }

  function mPrReject() {
    return head('Reject payroll', 'The run returns to the maker with this reason. It is not deleted.') +
      '<div class="modal-body">' + field('Rejection reason', ta('pr-rej', 'ui.pr.rejectReason', S.ui.pr.rejectReason || '', { rows: 3, ph: 'What must be corrected' }), { for: 'pr-rej', req: true }) + '</div>' +
      '<div class="modal-foot"><span class="grow"></span>' + btn('Cancel', { act: 'closeModal' }) + btn('Reject and return', { act: 'prRejectSave', cls: 'btn-primary' }) + '</div>';
  }

  function prSummaryHtml(run) {
    const t = prTotals(prActive(run));
    const ex = (run.lines || []).filter(l => l.blocked || l.included === false).length;
    return '<ul style="margin:8px 0 0;padding-left:18px"><li>Period: ' + esc(run.monthLabel) + ' (' + esc(run.periodStart) + ' – ' + esc(run.periodEnd) + ')</li><li>Employees in run: ' + t.n + '</li><li>Gross payroll: ' + inr(t.gross) + '</li><li>Total deductions: ' + inr(t.ded) + '</li><li>Net payroll payable: ' + inr(t.net) + '</li><li>Approval: ' + esc(PR_STATUS[run.status][0]) + '</li><li>Outstanding exceptions: ' + ex + '</li></ul>';
  }

  function wire() {
    prEnsure();
    document.addEventListener('toggle', function (e) {
      const d = e.target && e.target.closest && e.target.closest('details.pr-proto');
      if (!d || !S.ui || !S.ui.pr) return;
      S.ui.pr.protoOpen = !!d.open;
    }, true);
    const check = prSelfCheck(prRuns());
    if (!check.ok) console.error('Payroll self-check failed', check);
    const perf = (typeof NAV_SECTIONS !== 'undefined') && NAV_SECTIONS.find(s => s.id === 'performance');
    const item = perf && perf.items.find(i => i.nest === 'payroll');
    if (item) {
      item.children = [['payruns', 'Pay runs & payslips', 'cash'], ['payroll', 'Payroll reports', 'pie']];
      delete item.k;
    }
    META.payruns = ['Payroll', 'Pay runs & payslips'];
    META.payroll = ['Payroll', 'Payroll reports'];
    VIEWS.payruns = vPayruns;
    VIEWS.payroll = vPayroll;
    DRAWERS.pay = dPay;
    MODALS.prReject = mPrReject;

    const prevHook = modelHooks;
    modelHooks = function (path, val) {
      prevHook(path, val);
      if (path === 'ui.pr.runId' && val && (S.ui.pr.preview === 'norun' || S.ui.pr.preview === 'error')) S.ui.pr.preview = 'live';
      const m = String(path).match(/^data\.payruns\.#([^.]+)\.lines\.#([^.]+)\.excludeReason$/);
      if (!m) return;
      const run = prRun(m[1]);
      const line = run && (run.lines || []).find(l => l.id === m[2]);
      if (!line || line.blocked) return;
      line.included = !val;
      if (line.included) line.excludeReason = '';
      prDirty(run);
    };
    const prevHookBasis = modelHooks;
    modelHooks = function (path, val) {
      prevHookBasis(path, val);
      const b = String(path).match(/^data\.payruns\.#([^.]+)\.basis$/);
      if (!b) return;
      const run = prRun(b[1]);
      if (run && val !== 'annual' && val !== 'monthly') run.basis = 'monthly';
      if (run) prDirty(run);
    };
    const prevReset = ACT.resetDataNow;
    ACT.resetDataNow = function () {
      prevReset();
      prEnsure();
      render();
    };

    function flash(tab) {
      S.ui.pr.busy = true;
      render();
      setTimeout(function () { S.ui.pr.busy = false; render(); }, 180);
    }
    ACT.prTab = function (tab) {
      if (S.ui.pr.tab === tab) return;
      S.ui.pr.tab = tab;
      flash();
    };
    ACT.prPreview = function (v) { S.ui.pr.preview = v || 'live'; S.ui.pr.exportErr = ''; render(); };
    ACT.prResetFilters = function () { S.ui.pr.q = ''; S.ui.pr.dept = ''; render(); };
    ACT.prSort = function (key) {
      if (S.ui.pr.sort === key) S.ui.pr.dir = S.ui.pr.dir > 0 ? -1 : 1;
      else { S.ui.pr.sort = key; S.ui.pr.dir = key === 'name' || key === 'id' || key === 'dept' ? 1 : -1; }
      render();
    };
    ACT.prDrill = function (dept) { S.ui.pr.dept = dept || ''; S.ui.pr.tab = 'register'; go('#/payroll'); };
    ACT.prPick = function (id) { S.ui.pr.runId = id; S.ui.pr.preview = 'live'; S.ui.pr.tab = 'register'; go('#/payroll'); };
    ACT.prTrendPick = function (id) { S.ui.pr.runId = id; S.ui.pr.preview = 'live'; render(); };
    ACT.prDash = function () { S.ui.pr.step = ''; render(); };
    ACT.prCreate = function () {
      if (!prCan('create')) { toast('HR, Admin or Maker can create a pay run.', 'warning'); return; }
      S.ui.pr.step = 'form';
      S.ui.pr.formMonth = prSuggestMonth();
      S.ui.pr.formTried = false;
      render();
    };
    ACT.prFormSave = function () {
      if (!prCan('create')) { toast('HR, Admin or Maker can create a pay run.', 'warning'); return; }
      S.ui.pr.formTried = true;
      const ym = S.ui.pr.formMonth;
      if (prFormError(ym)) { render(); return; }
      let id = 'PR-' + ym, n = 2;
      while (prRuns().some(r => r.id === id)) { id = 'PR-' + ym + '-' + n; n += 1; }
      const run = {
        id: id, monthLabel: prMonthLabel(ym), periodStart: ym + '-01', periodEnd: prPeriodEnd(ym),
        status: 'draft', basis: 'monthly', step: 'select', processed: '', paidOn: '', rejection: '',
        calculatedAt: '', calculated: false,
        history: [{ at: TODAY, who: prWho(), text: 'Pay run created. Not calculated and not submitted.' }],
        lines: prCopy(prBaseLines()).concat([prBlocked()])
      };
      prRuns().unshift(run);
      S.ui.pr.runId = id;
      S.ui.pr.step = 'select';
      S.ui.pr.pickQ = '';
      S.ui.pr.pickDept = '';
      toast('Pay run created. Select employees next. Nobody has been paid.', 'success');
      render();
    };
    ACT.prOpen = function (id) {
      const run = prRun(id);
      if (!run) return;
      S.ui.pr.runId = id;
      S.ui.pr.preview = 'live';
      S.ui.pr.step = prStepFor(run);
      go('#/payruns');
    };
    ACT.prTo = function (step) {
      const run = prRun();
      if (!run) { S.ui.pr.step = 'form'; render(); return; }
      if ((step === 'salary' || step === 'review' || step === 'approve' || step === 'final') && prTotals(prActive(run)).empty) {
        toast('Select at least one eligible employee.', 'warning');
        S.ui.pr.step = 'select';
        render();
        return;
      }
      if (step === 'review' || step === 'approve' || step === 'final') {
        if (run.basis !== 'annual' && run.basis !== 'monthly') run.basis = 'monthly';
      }
      if ((step === 'approve' || step === 'final') && !prIsCalc(run)) {
        toast('Calculate payroll before approval.', 'warning');
        S.ui.pr.step = 'review';
        render();
        return;
      }
      if (step === 'final' && run.status !== 'approved' && !prClosed(run)) {
        toast('Approve the run before finalizing.', 'warning');
        return;
      }
      run.step = step;
      S.ui.pr.step = step;
      render();
    };
    ACT.prApplyPay = function (id) {
      const run = prRun();
      const line = run && (run.lines || []).find(l => l.id === id);
      if (!line || line.blocked || !prCan('edit', run)) return;
      const basis = run.basis === 'annual' ? 'annual' : 'monthly';
      const raw = S.ui.pr.edit && S.ui.pr.edit[id];
      const entered = raw === '' || raw == null ? (basis === 'annual' ? prAnnualCtc(line) : prEarnings(line)) : +raw;
      let monthly = entered;
      if (basis === 'annual') {
        monthly = Math.round(entered / 12 - prNum(line.epfEr) - prNum(line.esiEr));
        if (!(monthly > 0)) { toast('Annual CTC has to cover the employer contributions already stored.', 'warning'); return; }
      }
      if (!(monthly > 0)) { toast('Enter an amount greater than zero.', 'warning'); return; }
      if (monthly === prEarnings(line)) { toast('That amount already matches the structure.', 'info'); return; }
      prScaleEarnings(line, monthly);
      prDirty(run);
      toast('Earnings updated. EPF, ESI, PT and TDS were not recomputed.', 'info');
      render();
    };
    // shortcut: entered earnings stay excluded until a payroll engine supplies EPF, ESI, PT and TDS.
    ACT.prSaveStructure = function (id) {
      const run = prRun();
      const line = run && (run.lines || []).find(l => l.id === id);
      if (!line || !prCan('edit', run)) return;
      const f = S.ui.pr.struct || {};
      if (!(+f.basic > 0)) { toast('Enter basic pay. This employee stays out of the run until then.', 'warning'); return; }
      line.basic = +f.basic;
      line.hra = +f.hra || 0;
      line.special = +f.special || 0;
      line.otherE = 0;
      line.epf = null; line.esi = null; line.pt = null; line.tds = null; line.epfEr = null; line.esiEr = null;
      line.blocked = 'statutory-pending';
      line.included = false;
      line.detail = 'Earnings were entered here. EPF, ESI, professional tax and TDS are not calculated in this prototype, so this employee stays excluded.';
      prDirty(run);
      toast(line.name + ' is still excluded. Statutory deductions are not calculated here.', 'info');
      render();
    };
    ACT.prEmp = function (id) { openDrawer({ type: 'pay', id: id, run: S.ui.pr.runId }); };
    ACT.prToggle = function (id, _b, _t, e) {
      if (e) e.preventDefault();
      const run = prRun();
      const line = run && (run.lines || []).find(l => l.id === id);
      if (!line || line.blocked || !prCan('edit', run)) return;
      line.included = line.included === false;
      line.excludeReason = line.included ? '' : (line.excludeReason || 'On leave');
      prDirty(run);
      render();
    };
    ACT.prSelectEligible = function () {
      const run = prRun();
      if (!prCan('edit', run)) { toast('This run is locked.', 'info'); return; }
      run.lines.forEach(l => { if (l.blocked) return; l.included = true; l.excludeReason = ''; });
      prDirty(run);
      toast('Eligible employees are selected. Missing salary stays out.', 'info');
      render();
    };
    ACT.prRecalc = function () {
      const run = prRun();
      if (!prCan('calc', run)) return;
      if (prTotals(prActive(run)).empty) { toast('Select at least one employee before calculating.', 'warning'); return; }
      run.calculated = true;
      run.calculatedAt = TODAY;
      prLog(run, 'Calculated from salary structures, attendance, approved timesheets and leave. Not submitted and not paid.');
      toast('Payroll calculated. Review it before you submit. Nobody has been paid.', 'success');
      render();
    };
    ACT.prSubmit = function () {
      const run = prRun();
      if (!prCan('submit', run)) { toast('Only the maker can submit this run.', 'warning'); return; }
      if (!prIsCalc(run)) { toast('Calculate payroll before submitting.', 'warning'); return; }
      if (prTotals(prActive(run)).empty) { toast('Include at least one employee before submitting.', 'warning'); return; }
      confirmBox(run.status === 'rejected' ? 'Resubmit payroll?' : 'Submit for review?', prSummaryHtml(run) + '<p style="margin:8px 0 0">The checker reviews this next. Submitting does not pay anyone.</p>', 'Submit', 'neutral', function () {
        run.status = 'review';
        run.step = 'approve';
        S.ui.pr.step = 'approve';
        prLog(run, run.rejection ? 'Resubmitted for checker review.' : 'Submitted for checker review.');
        toast('Submitted for review. Salaries have not been paid.', 'success');
      });
    };
    ACT.prApprove = function () {
      const run = prRun();
      if (!prCan('approve', run)) { toast(prMode() === 'single' ? 'HR or Admin approves in single-level setup.' : 'The checker approves a submitted run.', 'warning'); return; }
      if (!prIsCalc(run)) { toast('Calculate payroll before approving.', 'warning'); return; }
      confirmBox('Approve payroll?', prSummaryHtml(run) + '<p style="margin:8px 0 0">Approval does not finalize payslips and does not mean employees are paid.</p>', 'Approve', 'neutral', function () {
        run.status = 'approved';
        run.rejection = '';
        run.step = 'final';
        S.ui.pr.step = 'final';
        prLog(run, prMode() === 'single' ? 'Approved by the authorized approver.' : 'Checker approved.');
        toast('Approved. Finalize when you are ready to generate payslips.', 'success');
      });
    };
    ACT.prRejectOpen = function () {
      if (!prCan('reject', prRun())) { toast('You cannot reject this run.', 'warning'); return; }
      S.ui.pr.rejectReason = '';
      openModal({ type: 'prReject' });
    };
    ACT.prRejectSave = function () {
      const reason = String(S.ui.pr.rejectReason || '').trim();
      if (!reason) { toast('Enter the rejection reason.', 'warning'); return; }
      const run = prRun();
      if (!run) return;
      run.status = 'rejected';
      run.rejection = reason;
      run.step = 'review';
      S.ui.pr.step = 'review';
      prLog(run, 'Rejected: ' + reason + ' Returned to the maker.');
      S.ui.modal = null;
      toast('Returned to the maker. The run is still in history.', 'info');
      render();
    };
    ACT.prFinalize = function () {
      const run = prRun();
      if (!prCan('finalize', run)) { toast('Approve the run before finalizing.', 'warning'); return; }
      const dup = prDuplicate(run);
      if (dup) { toast(run.monthLabel + ' already has ' + dup.id + '. This run stays open so those employees are not counted twice.', 'warning'); return; }
      if (prTotals(prActive(run)).empty) { toast('Nobody is included. Finalizing would not be a ₹0 payroll.', 'warning'); return; }
      confirmBox('Finalize payroll and generate payslips?', prSummaryHtml(run) + '<p style="margin:8px 0 0">Finalizing locks the calculation and generates payslips. It does not transfer salaries. You cannot generate this run twice.</p>', 'Finalize', 'neutral', function () {
        run.status = 'finalized';
        run.processed = TODAY;
        run.step = 'done';
        S.ui.pr.step = 'done';
        run.lines.forEach(l => { if (!l.blocked && l.included !== false) l.payslip = true; });
        prLog(run, 'Finalized. Payslips generated. No bank transfer was sent.');
        toast('Payslips generated. Record payment only after finance confirms the transfer.', 'success');
      });
    };
    ACT.prPaid = function () {
      const run = prRun();
      if (!prCan('paid', run)) return;
      const t = prTotals(prActive(run));
      confirmBox('Record salary as paid?', '<p style="margin:0">This records that finance confirmed an external payment of <b>' + inr(t.net) + '</b> for ' + esc(run.monthLabel) + '. APTCORE does not send the transfer.</p>', 'Record paid', 'neutral', function () {
        run.status = 'paid';
        run.paidOn = TODAY;
        run.step = 'done';
        S.ui.pr.step = 'done';
        prLog(run, 'Marked paid after finance confirmed the external transfer.');
        toast('Paid amount recorded. No bank transaction was sent from APTCORE.', 'success');
      });
    };
    ACT.prPrint = function () { window.print(); };
    ACT.prExport = function (kind) {
      const run = prShownRun();
      if (!run && kind !== 'trends') { toast('Select a pay run before exporting.', 'warning'); return; }
      if (S.settings.simulateFailure) {
        S.ui.pr.exportErr = 'Export failed. No file was created. Turn off “Simulate an email delivery failure” under Prototype notes, then retry.';
        toast('Export failed. Nothing was downloaded.', 'danger');
        render();
        return;
      }
      S.ui.pr.exportErr = '';
      const lines = run ? prActive(run) : [];
      const stamp = ['Generated', TODAY, 'Period', run ? run.periodStart + ' to ' + run.periodEnd : '', 'Run', run ? run.id : '', 'Status', run ? PR_STATUS[run.status][0] : ''];
      let rows;
      if (kind === 'statutory') {
        rows = [stamp, [], ['Employee', 'ID', 'Department', 'Basic', 'EPF employee', 'EPF employer', 'ESI employee', 'ESI employer', 'PT', 'TDS']].concat(lines.map(l => [l.name, l.id, prDeptName(l.dept), l.basic, l.epf, l.epfEr, l.esi == null ? 'Not applicable' : l.esi, l.esi == null ? 'Not applicable' : l.esiEr, l.pt, l.tds]));
      } else {
        rows = [stamp, [], ['Employee', 'ID', 'Department', 'Basic', 'HRA', 'Special allowance', 'Other earnings', 'Gross', 'EPF', 'ESI', 'PT', 'TDS', 'LOP', 'Other deductions', 'Total deductions', 'Net pay']].concat(lines.map(l => [l.name, l.id, prDeptName(l.dept), l.basic, l.hra, l.special, l.otherE, l.gross, l.epf, l.esi == null ? 'Not applicable' : l.esi, l.pt, l.tds, l.lop, l.otherD, l.ded, l.net]));
      }
      const csv = rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const done = function () { toast('Report copied as CSV, including the period and generation date. Paste it into Excel or Sheets.', 'success'); };
      try { navigator.clipboard.writeText(csv).then(done, function () { toast('Could not copy the report.', 'danger'); }); }
      catch (e) { toast('Could not copy the report.', 'danger'); }
      render();
    };
  }

  wire();
  if (typeof root.__aptBoot === 'function') root.__aptBoot();
})(typeof window !== 'undefined' ? window : global);
