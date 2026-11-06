const fs = require('fs');
const p = require('path').join(__dirname, '..', 'aptcore-hrms-invoicing.html');
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('/* 9.1 Overview (Screen 01) */');
const end = s.indexOf('/* Shared invoice table (Overview + Invoices & payments) */');
if (start < 0 || end < 0) { console.error('markers missing', start, end); process.exit(1); }

const next = `/* 9.1 Overview (Screen 01) */
function dueRelLabel(date){
  const d = diffDays(TODAY, date);
  if(d === 0) return { text:'Due today', cls:'is-today' };
  if(d === 1) return { text:'Due tomorrow', cls:'is-soon' };
  if(d > 1 && d <= 3) return { text:\`Due in \${d} days\`, cls:'is-soon' };
  if(d > 3) return { text:\`Due in \${d} days\`, cls:'' };
  if(d === -1) return { text:'1 day overdue', cls:'is-today' };
  return { text:\`\${Math.abs(d)} days overdue\`, cls:'is-today' };
}
function attentionItems(){
  const c = C(), items = [];
  const push = (t) => { items.push(Object.assign({ id:t.id||('att-'+items.length), filter:'', cat:'A', urgency:0, primary:false, bulk:null, details:[] }, t)); };
  S.data.invoices.filter(i=>overdueDays(i)>0).forEach(i => {
    const od = overdueDays(i), bal = balance(i), cname = cl(i.client).name, place = pl(i.placement);
    push({ id:'od-'+i.id, sev:0, urgency:od, filter:'overdue', cat:'A', icon:'alertCircle', tone:'danger',
      title:\`Client payment overdue by \${od} days\`,
      ctx:\`\${invNo(i)} · \${cname} · balance \${money(bal)}\`,
      st:['Overdue','danger'], act:'openEmail', a:i.id, b:'reminder', label:'Send reminder', primary:false, bulk:'reminder',
      details:[
        ['Invoice number', esc(invNo(i))],
        ['Client', esc(cname)],
        ['Employee / placement', esc(consOf(place).name)],
        ['Invoice amount', money(invTotal(i))],
        ['Outstanding balance', money(bal)],
        ['Billing period', esc(pe(i.period).label)],
        ['Due date', \`\${fmtD(i.due)} · \${od} days overdue\`],
        ['Reason for the issue', 'Client payment not received after the due date.'],
        ['Recommended next action', 'Send a payment reminder, then record the payment when funds arrive.']
      ] });
  });
  S.data.invoices.filter(i=>i.status==='awaiting' && checks(i).blocking).forEach(i => {
    const k = checks(i).list.find(x=>x.kind==='mismatch'||x.kind==='missing') || checks(i).list[0];
    const place = pl(i.placement);
    push({ id:'blk-'+i.id, sev:1, urgency:5, filter:'blocked', cat:'A', icon:'shield', tone:'danger',
      title:\`Verification blocked: \${k.title}\`,
      ctx:\`\${invNo(i)} · \${consOf(place).name} · \${pe(i.period).label}\`,
      st:['Blocked','danger'], act:'openAudit', a:i.id, label:'Resolve', primary:true,
      details:[
        ['Invoice number', esc(invNo(i))],
        ['Client', esc(cl(i.client).name)],
        ['Employee / placement', esc(consOf(place).name)],
        ['Invoice amount', money(invTotal(i))],
        ['Billing period', esc(pe(i.period).label)],
        ['Reason for the issue', esc(k.detail || k.title)],
        ['Recommended next action', 'Open verification and resolve the blocking check.']
      ] });
  });
  S.data.invoices.filter(i=>i.status==='correction').forEach(i => {
    const place = pl(i.placement), reason = (i.correction && i.correction.reason) || 'Returned for correction';
    push({ id:'corr-'+i.id, sev:1, urgency:8, filter:'correction', cat:'A', icon:'undo', tone:'danger',
      title:'Invoice returned for correction',
      ctx:\`\${invNo(i)} · \${consOf(place).name} · \${reason}\`,
      st:['Needs correction','danger'], act:'openAudit', a:i.id, label:'Fix', primary:true,
      details:[
        ['Invoice number', esc(invNo(i))],
        ['Client', esc(cl(i.client).name)],
        ['Employee / placement', esc(consOf(place).name)],
        ['Invoice amount', money(invTotal(i))],
        ['Billing period', esc(pe(i.period).label)],
        ['Reason for the issue', esc(reason)],
        ['Recommended next action', 'Correct the invoice details and resubmit for verification.']
      ] });
  });
  c.gaps.forEach(g => {
    const n = consOf(g.pl).name, cn = cl(g.pl.client).name;
    if(g.kind==='blocked') push({ id:'pl-'+g.pl.id+'-'+g.per.id, sev:1, urgency:g.daysLate||3, filter:'blocked', cat:'C', icon:'link', tone:'danger',
      title:\`Placement setup incomplete — \${n}\`,
      ctx:\`Missing \${g.issues.join(', ').toLowerCase()} · blocks \${cn}, \${g.per.label}\`,
      st:['Blocked','danger'], act:'openPlacement', a:g.pl.id, label:'Fix placement', primary:true,
      details:[
        ['Employee / placement', esc(n)],
        ['Client', esc(cn)],
        ['Billing period', esc(g.per.label)],
        ['Reason for the issue', \`Missing \${esc(g.issues.join(', ').toLowerCase())}\`],
        ['Recommended next action', 'Complete the placement setup so invoicing can continue.']
      ] });
    else if(g.kind==='nots') push({ id:'ts-'+g.pl.id+'-'+g.per.id, sev:1, urgency:g.daysLate||2, filter:'missing', cat:'C', icon:'timesheet', tone:'warning',
      title:\`Timesheet not received — \${n}\`,
      ctx:\`\${cn} · \${g.per.label} · period ended \${plural(g.daysLate,'day')} ago\${g.rem?\` · reminder sent \${fmtDs(g.rem.date)}\`:''}\`,
      st:['Missing','danger'], act:'tsReminder', a:g.pl.id, b:g.per.id, label:g.rem?'Remind again':'Send reminder', primary:false, bulk:'ts-reminder',
      undo:{ key:'rem-'+g.pl.id+'-'+g.per.id, label:g.rem?'Remind again':'Send reminder', doneLabel:'Reminder sent', icon:'mail', undoneMsg:'no reminder was sent', run:()=>ACT.tsReminder(g.pl.id,g.per.id) },
      details:[
        ['Employee / placement', esc(n)],
        ['Client', esc(cn)],
        ['Billing period', esc(g.per.label)],
        ['Due date', \`Period ended \${fmtD(g.per.end)} (\${plural(g.daysLate,'day')} ago)\`],
        ['Relevant history', g.rem ? \`Reminder sent \${fmtD(g.rem.date)}\` : 'No timesheet reminder sent yet'],
        ['Recommended next action', 'Send a timesheet reminder to the consultant and employer.']
      ] });
    else push({ id:'ready-'+g.pl.id+'-'+g.per.id, sev:2, urgency:1, filter:'ready', cat:'B', icon:'upload', tone:'info',
      title:\`Invoice not created — \${n}\`,
      ctx:\`\${cn} · \${g.per.label} · timesheet received \${fmtDs(g.ts.received)}\`,
      st:['Ready to invoice','info'], act:'startBatch', a:g.per.id, label:'Start batch', primary:true, bulk:'batch',
      details:[
        ['Employee / placement', esc(n)],
        ['Client', esc(cn)],
        ['Billing period', esc(g.per.label)],
        ['Relevant history', \`Timesheet received \${fmtD(g.ts.received)}\`],
        ['Recommended next action', 'Start an invoice batch for this billing period.']
      ] });
  });
  c.payouts.filter(x=>x.p.status==='Overdue').forEach(({i,p}) => {
    const place = pl(i.placement);
    push({ id:'po-'+i.id, sev:1, urgency:p.late||4, filter:'overdue', cat:'A', icon:'out', tone:'danger',
      title:\`Vendor payout overdue — \${p.vendor.name}\`,
      ctx:\`\${consOf(place).name} · \${money(p.amount)} was due \${fmtDs(p.due)} (\${plural(p.late,'day')} late)\`,
      st:['Outgoing','danger'], act:'openPayout', a:i.id, label:'Record payout', primary:true,
      details:[
        ['Invoice number', esc(invNo(i))],
        ['Vendor', esc(p.vendor.name)],
        ['Employee / placement', esc(consOf(place).name)],
        ['Invoice amount', money(p.amount)],
        ['Due date', \`\${fmtD(p.due)} · \${plural(p.late,'day')} late\`],
        ['Recommended next action', 'Record the vendor payout and send confirmation.']
      ] });
  });
  if(c.verified) push({ id:'send-ready', sev:2, urgency:0, filter:'ready', cat:'B', icon:'send', tone:'info',
    title:\`\${plural(c.verified,'verified invoice')} ready to send\`,
    ctx:'Verified and waiting to be emailed to the client',
    st:['Ready to send','info'], act:'go', a:'#/invoices?quick=ready', label:'Review & send', primary:true,
    details:[
      ['Reason for the issue', 'Verified invoices are waiting to be emailed.'],
      ['Recommended next action', 'Review the ready queue and send invoices to clients.']
    ] });
  const ready = S.data.invoices.filter(i=>i.status==='awaiting' && !checks(i).blocking).length;
  if(ready) push({ id:'ver-ready', sev:2, urgency:0, filter:'ready', cat:'B', icon:'shield', tone:'pending',
    title:\`\${plural(ready,'invoice')} ready for verification review\`,
    ctx:'No blocking issues — review warnings and approve',
    st:['Awaiting','pending'], act:'go', a:'#/verify?tab=ready', label:'Open queue', primary:false,
    details:[
      ['Reason for the issue', 'Invoices are waiting in the verification ready queue.'],
      ['Recommended next action', 'Open the verification queue and approve invoices without blocking issues.']
    ] });
  S.data.invoices.filter(i=>payStatus(i)==='Partially Paid' && !overdueDays(i)).forEach(i => {
    const place = pl(i.placement);
    push({ id:'part-'+i.id, sev:3, urgency:0, filter:'ready', cat:'B', icon:'inn', tone:'pending',
      title:'Partially paid — balance still open',
      ctx:\`\${invNo(i)} · \${cl(i.client).name} · \${money(balance(i))} of \${money(invTotal(i))} outstanding\`,
      st:['Partially Paid','pending'], act:'openPayment', a:i.id, label:'Record payment', primary:false,
      details:[
        ['Invoice number', esc(invNo(i))],
        ['Client', esc(cl(i.client).name)],
        ['Employee / placement', esc(consOf(place).name)],
        ['Invoice amount', money(invTotal(i))],
        ['Outstanding balance', money(balance(i))],
        ['Due date', fmtD(i.due)],
        ['Recommended next action', 'Record the remaining client payment.']
      ] });
  });
  c.payouts.filter(x=>x.p.status==='Paid' && !x.p.confirm).forEach(({i,p}) => {
    push({ id:'conf-'+i.id, sev:3, urgency:0, filter:'ready', cat:'C', icon:'mail', tone:'neutral',
      title:\`Payment confirmation not sent — \${p.vendor.name}\`,
      ctx:\`Payout of \${money(p.amount)} on \${fmtDs(p.rec.paid)} for \${consOf(pl(i.placement)).name}\`,
      st:['Outgoing','neutral'], act:'sendConfirm', a:i.id, label:'Send confirmation', primary:false,
      undo:{ key:'conf-'+i.id, label:'Send confirmation', doneLabel:'Confirmation sent', icon:'mail', undoneMsg:'no confirmation was sent', run:()=>ACT.sendConfirm(i.id) },
      details:[
        ['Vendor', esc(p.vendor.name)],
        ['Invoice amount', money(p.amount)],
        ['Relevant history', \`Paid on \${fmtD(p.rec.paid)}\`],
        ['Recommended next action', 'Send the payment confirmation to the vendor.']
      ] });
  });
  return items.sort((a,b)=>a.sev-b.sev || (b.urgency||0)-(a.urgency||0) || String(a.title).localeCompare(String(b.title)));
}
function attActionBtn(t){
  if(t.undo) return undoBtn(t.undo);
  const cls = t.primary ? 'btn btn-sm btn-primary' : 'btn btn-sm';
  return \`<button type="button" class="\${cls}" data-act="\${t.act}" data-a="\${esc(t.a)}" \${t.b!=null?\`data-b="\${esc(t.b)}"\` :''} aria-label="\${esc(t.label + ' — ' + t.title)}"><span>\${esc(t.label)}</span>\${ic('chevR',14,2)}</button>\`;
}
function renderAttItem(t, ui){
  const expanded = !!(ui.expanded && ui.expanded[t.id]);
  const selected = !!(ui.sel && ui.sel[t.id]);
  const canBulk = !!t.bulk;
  return \`<article class="att-item \${expanded?'is-expanded':''} \${selected?'is-selected':''}" data-att-id="\${esc(t.id)}">
    <div class="att-row">
      <span class="att-check">\${canBulk?\`<input type="checkbox" data-act="attSel" data-a="\${esc(t.id)}" \${selected?'checked':''} aria-label="Select: \${esc(t.title)}">\`:'<span class="sr-only">Not batch-eligible</span>'}</span>
      <span class="lr-ic \${t.tone}" aria-hidden="true">\${ic(t.icon,16)}</span>
      <div class="att-body">
        <button type="button" class="att-title" style="all:unset;cursor:pointer;display:block" data-act="attToggle" data-a="\${esc(t.id)}" aria-expanded="\${expanded}" aria-controls="att-d-\${esc(t.id)}" id="att-t-\${esc(t.id)}">\${esc(t.title)}</button>
        <span class="att-meta">\${esc(t.ctx)}</span>
      </div>
      <span class="att-status">\${badge(t.st[0],t.st[1])}</span>
      <span class="att-act">
        \${attActionBtn(t)}
        <button type="button" class="att-expand" data-act="attToggle" data-a="\${esc(t.id)}" aria-expanded="\${expanded}" aria-controls="att-d-\${esc(t.id)}" aria-label="\${expanded?'Hide':'Show'} details for \${esc(t.title)}">\${ic(expanded?'chevD':'chevR',16,2)}</button>
      </span>
    </div>
    \${expanded?\`<div class="att-detail" id="att-d-\${esc(t.id)}" role="region" aria-labelledby="att-t-\${esc(t.id)}">
      <dl>\${(t.details||[]).map(([k,v])=>\`<dt>\${esc(k)}</dt><dd>\${v}</dd>\`).join('')}</dl>
      <div class="att-next"><span class="medium">Next step:</span> \${esc(t.label)}</div>
    </div>\`:''}
  </article>\`;
}
function vOverview(){
  const c = C(), attAll = attentionItems();
  if(!S.ui.att) S.ui.att = { filter:'all', showAll:false, expanded:{}, sel:{} };
  const ui = S.ui.att;
  const counts = {
    all: attAll.length,
    overdue: attAll.filter(t=>t.filter==='overdue').length,
    blocked: attAll.filter(t=>t.filter==='blocked').length,
    correction: attAll.filter(t=>t.filter==='correction').length,
    ready: attAll.filter(t=>t.filter==='ready').length
  };
  const filter = counts[ui.filter] != null ? ui.filter : 'all';
  if(ui.filter !== filter) ui.filter = filter;
  const filtered = filter==='all' ? attAll : attAll.filter(t=>t.filter===filter);
  const limit = 5;
  const shown = ui.showAll ? filtered : filtered.slice(0, limit);
  const hidden = Math.max(0, filtered.length - shown.length);
  const selIds = Object.keys(ui.sel||{}).filter(k=>ui.sel[k]);
  const selected = selIds.map(id => attAll.find(t=>t.id===id)).filter(Boolean);
  const canRemind = selected.length && selected.every(t=>t.bulk==='reminder' || t.bulk==='ts-reminder');
  const canBatch = selected.length && selected.every(t=>t.bulk==='batch') && new Set(selected.map(t=>t.a)).size===1;
  const recent = [...S.data.invoices].sort((a,b)=>(b.dates.gen||'').localeCompare(a.dates.gen||'')||b.id.localeCompare(a.id)).slice(0,6);
  const kpi = (label, icon, val, sub, go, tone) => \`<button type="button" class="kpi" data-act="go" data-a="\${go}" aria-label="\${esc(label)}: \${esc(val)}. Open filtered list"><span class="kpi-top"><span class="kpi-ic" \${tone?\`style="background:var(--\${tone}-bg);color:var(--\${tone})"\` :''}>\${ic(icon,16)}</span><span class="kpi-lbl">\${esc(label)}</span>\${ic('out',14,2,'faint')}</span><span class="kpi-val">\${val}</span><span class="kpi-sub">\${sub}</span></button>\`;
  const upcoming = [];
  S.data.invoices.forEach(i => {
    const p = payoutInfo(i);
    if(p && !p.rec && diffDays(TODAY,p.due)>=0 && diffDays(TODAY,p.due)<=21)
      upcoming.push({ d:p.due, kind:'vendor', t:'Vendor payout due', who:p.vendor.name, ref:invNo(i), amt:p.amount });
    if(i.status==='sent' && balance(i)>0 && diffDays(TODAY,i.due)>=0 && diffDays(TODAY,i.due)<=21)
      upcoming.push({ d:i.due, kind:'client', t:'Client payment due', who:cl(i.client).name, ref:invNo(i), amt:balance(i) });
  });
  upcoming.sort((a,b)=>a.d.localeCompare(b.d));
  const finRows = [
    { icon:'inn', label:'Outstanding receivables', val:money(c.outstanding), desc:'Total unpaid client invoices', go:'#/invoices?quick=unpaid', cls:'is-primary', aria:'Outstanding receivables are total unpaid client invoices' },
    { icon:'alertCircle', label:'Overdue receivables', val:money(c.overdueAmt), desc:'Unpaid invoices past their due date (included in outstanding)', go:'#/invoices?quick=overdue', cls:'is-overdue', aria:'Overdue receivables are a subset of outstanding receivables' },
    { icon:'checkCircle', label:'Received in October', val:money(c.paidOct), desc:'Client payments received during October', go:'#/invoices?quick=paid', cls:'is-positive', aria:'Payments received in October' },
    { icon:'out', label:'Open vendor payouts', val:money(c.payOpenAmt), desc:'Payments owed to sub-vendors', go:'#/vendor', cls:'', aria:'Open vendor payouts' }
  ];
  const filterSeg = seg('Attention filters', 'ui.att.filter', [
    { v:'all', l:'All', c:counts.all },
    { v:'overdue', l:'Overdue', c:counts.overdue },
    { v:'blocked', l:'Blocked', c:counts.blocked },
    { v:'correction', l:'Needs correction', c:counts.correction },
    { v:'ready', l:'Ready to process', c:counts.ready }
  ], filter);
  return \`<div class="page">
    \${pageHead('Staffing billing & invoices', 'Timesheet to payment — start with what needs attention.',
      btn('Billing setup',{act:'go',a:'#/placements',icon:'settings'}) + btn('Start invoice batch',{act:'go',a:'#/batch',cls:'btn-primary',icon:'plus'}))}
    \${flowStrip('')}
    <section aria-label="Work summary" class="grid g-kpi">
      \${kpi('In verification','shield', c.awaiting+c.correction, c.blocked+c.correction ? badge(\`\${c.blocked+c.correction} blocked\`,'danger') : badge('Clear','success'), '#/verify', 'pending')}
      \${kpi('Ready to send','send', c.verified, c.verified ? badge('Awaiting email','info') : badge('None','neutral'), '#/invoices?quick=ready', 'info')}
      \${kpi('Overdue client payments','alertCircle', money0(c.overdueAmt), badge(plural(c.overdue,'invoice'),'danger'), '#/invoices?quick=overdue', 'danger')}
      \${kpi('Missing invoices','flag', c.gapCount, c.gapCount ? badge(\`\${c.gapCount} periods\`,'warning') : badge('Covered','success'), '#/reports', 'warning')}
    </section>
    <div class="grid g-2">
      <section class="card" aria-labelledby="att-h">
        <div class="card-head"><h2 class="card-title" id="att-h">Needs your attention</h2>\${badge(attAll.length+' open','neutral','nodot')}<span class="grow"></span><span class="small" style="color:var(--text-3)">Most urgent first</span></div>
        <div class="att-filters">\${filterSeg}<span class="sr-only" aria-live="polite">\${filtered.length} items in \${filter} filter</span></div>
        \${selected.length?\`<div class="att-bulk" role="region" aria-label="Bulk actions">
          <span class="att-bulk-n" aria-live="polite">\${plural(selected.length,'item')} selected</span>
          <span class="grow"></span>
          \${btn('Send reminders',{act:'attBulkRemind',cls:'btn-sm'+(canRemind?' btn-primary':''),disabled:!canRemind,aria:canRemind?'Send reminders for selected items':'Send reminders unavailable for this selection'})}
          \${btn('Start invoice batch',{act:'attBulkBatch',cls:'btn-sm'+(canBatch?' btn-primary':''),disabled:!canBatch,aria:canBatch?'Start batch for selected placements':'Batch unavailable — select ready-to-invoice items from one period'})}
          \${btn('Clear',{act:'attClearSel',cls:'btn-sm btn-ghost'})}
        </div>\`:''}
        \${filtered.length ? shown.map(t=>renderAttItem(t, ui)).join('') + (hidden?\`<div class="card-foot"><span>\${hidden} more \${hidden===1?'item':'items'} in this filter</span><button type="button" class="btn btn-sm btn-ghost" data-act="attShowAll" aria-label="View all \${filtered.length} attention items">View all \${filtered.length} items</button></div>\`: (ui.showAll && filtered.length>limit?\`<div class="card-foot"><span>Showing all \${filtered.length} items</span><button type="button" class="btn btn-sm btn-ghost" data-act="attShowLess">Show fewer</button></div>\`:''))
          : \`<div style="border-top:1px solid var(--divider)">\${emptyState(filter==='all'?'You’re all caught up':'No items in this filter', filter==='all'?'No blocked verifications, overdue payments or billing gaps right now.':'Try another filter or clear the selection.')}</div>\`}
      </section>
      <div class="col gap16">
        <section class="card" aria-labelledby="fin-h">
          <div class="card-head" style="padding-bottom:8px"><div class="col"><h2 class="card-title" id="fin-h">Financial snapshot</h2><span class="card-sub">All entities · as of \${fmtD(TODAY)}</span></div></div>
          <div class="card-body col" style="gap:0;padding-top:4px">
            \${finRows.map(r=>\`<button type="button" class="fin-row \${r.cls}" data-act="go" data-a="\${r.go}" aria-label="\${esc(r.aria + ': ' + r.val)}. Open filtered list">
              <span class="lr-ic" style="width:28px;height:28px" aria-hidden="true">\${ic(r.icon,15)}</span>
              <span class="col grow" style="min-width:0"><span class="row" style="justify-content:space-between;gap:12px;align-items:baseline"><span class="fin-lbl">\${esc(r.label)}</span><span class="fin-amt tnum">\${r.val}</span></span><span class="fin-desc">\${esc(r.desc)}</span></span>
            </button>\`).join('')}
          </div>
        </section>
        <section class="card" aria-labelledby="up-h">
          <div class="card-head" style="padding-bottom:6px"><h2 class="card-title" id="up-h">Next 3 weeks</h2><span class="grow"></span>\${btn('Reminder settings',{act:'openNotes',a:'assume',cls:'btn-sm',icon:'settings',aria:'Open reminder settings'})}</div>
          <div style="padding:0 20px 14px" role="list" aria-label="Upcoming payments">\${upcoming.length ? upcoming.slice(0,6).map(u=>{
            const rel = dueRelLabel(u.d);
            const dot = u.kind==='vendor' ? 'vendor' : 'client';
            return \`<div class="sched-row" role="listitem">
              <div class="sched-date"><span class="d">\${fmtDs(u.d)}</span><span class="r \${rel.cls}">\${esc(rel.text)}</span></div>
              <span class="sched-dot \${dot}" title="\${u.kind==='vendor'?'Vendor payout':'Client payment'}" aria-hidden="true"></span>
              <div class="col grow" style="min-width:0">
                <span class="sched-type">\${esc(u.t)}</span>
                <span class="sched-meta">\${esc(u.who)} · \${esc(u.ref)}</span>
              </div>
              <span class="sched-amt tnum">\${money(u.amt)}</span>
            </div>\`;
          }).join('') : '<p class="small" style="color:var(--text-3);margin:0">Nothing scheduled in the next 3 weeks.</p>'}</div>
        </section>
      </div>
    </div>
    <section class="card" aria-labelledby="rec-h">
      <div class="card-head"><div class="col"><h2 class="card-title" id="rec-h">Recent invoices</h2><span class="card-sub">Latest generated, with their invoice and payment status shown separately</span></div><span class="grow"></span><a data-act="go" data-a="#/invoices" class="small medium">View all invoices \${ic('chevR',14,2)}</a></div>
      \${invoiceTable(recent, { compact:true, noSel:true })}
    </section>
  </div>\`;
}

`;

fs.writeFileSync(p, s.slice(0, start) + next + s.slice(end));
console.log('overview replaced ok, bytes', fs.statSync(p).size);
