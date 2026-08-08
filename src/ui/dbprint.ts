
import { api } from '../db';
import type { Bill } from '../engine';
import { money, monthLabel, MONTHS } from '../engine';
import { toast } from './toast';
import { customSelect } from './select';
import { DROP_ICON, DROP_VIEWBOX } from '../logo';

export interface PrintOptions {
  period: 'all' | 'pick';
  month: string;
  detail: 'totals' | 'full';
}

const DB_MODAL_HTML = `
  <div class="dbmodal" role="dialog" aria-modal="true" aria-label="Print database logbook">
    <div class="dbmodal-mark"><svg viewBox="${DROP_VIEWBOX}" fill="currentColor" stroke="none"><path d="${DROP_ICON}"/></svg></div>
    <h2 class="dbmodal-title">Print Database Logbook</h2>
    <p class="dbmodal-sub">Ramos and Empress, always. Black-and-white, print-ready.</p>

    <div class="dbmodal-label">1 - Period</div>
    <div class="dbmodal-grid">
      <button type="button" class="dbmodal-opt sel" data-period="all">
        <span class="opt-title">All months - all years</span>
        <span class="opt-desc">Every month with billed data, grouped by year.</span>
      </button>
      <button type="button" class="dbmodal-opt" data-period="pick">
        <span class="opt-title">Pick a month</span>
        <span class="opt-desc">One billing period, both buildings.</span>
      </button>
    </div>
    <div class="dbmodal-pick" id="dbmodal-pick">
      <div class="select-wrap"><select id="dbmodal-month" aria-label="Month"></select></div>
      <div class="select-wrap"><select id="dbmodal-year" aria-label="Year"></select></div>
    </div>

    <div class="dbmodal-label">2 - Detail</div>
    <div class="dbmodal-grid">
      <button type="button" class="dbmodal-opt sel" data-detail="totals">
        <span class="opt-title">Totals only</span>
        <span class="opt-desc">Each room's volumetric charge + total, per month. No readings.</span>
      </button>
      <button type="button" class="dbmodal-opt" data-detail="full">
        <span class="opt-title">Go all in</span>
        <span class="opt-desc">Every field: present, previous, consumption, rate, volumetric, surcharge, total.</span>
      </button>
    </div>

    <div class="dbmodal-actions">
      <button type="button" class="dbmodal-cancel" id="dbmodal-cancel">Cancel</button>
      <button type="button" class="dbmodal-go" id="dbmodal-go">Print Logbook</button>
    </div>
  </div>
`;

export function openPrintDialog(): void {
  if (document.getElementById('dbmodal-back')) return;
  void (async () => {
    const bills = await api.getAllBills();

    if (document.getElementById('dbmodal-back')) return;
    const billed = bills.filter(b => b.presReading != null && (b.total ?? 0) > 0);
    const years = [...new Set(billed.map(b => (b.month || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    const now = new Date();
    const defYear = years[0] ?? String(now.getFullYear());
    const defMonth = String(now.getMonth() + 1).padStart(2, '0');
    renderDialog(years.length ? years : [defYear], defYear, defMonth);
  })();
}

function renderDialog(years: string[], defYear: string, defMonth: string): void {
  const back = document.createElement('div');
  back.className = 'dbmodal-back';
  back.id = 'dbmodal-back';
  back.innerHTML = DB_MODAL_HTML;
  document.body.appendChild(back);

  const monthSel = back.querySelector<HTMLSelectElement>('#dbmodal-month');
  const yearSel = back.querySelector<HTMLSelectElement>('#dbmodal-year');
  if (monthSel) {
    for (let i = 0; i < 12; i++) {
      const opt = document.createElement('option');
      opt.value = String(i + 1).padStart(2, '0');
      opt.textContent = MONTHS[i];
      monthSel.appendChild(opt);
    }
    monthSel.value = defMonth;
  }
  if (yearSel) {
    for (const y of years) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSel.appendChild(opt);
    }
    yearSel.value = defYear;
  }

  if (monthSel) customSelect(monthSel);
  if (yearSel) customSelect(yearSel);

  let selPeriod: PrintOptions['period'] = 'all';
  let selDetail: PrintOptions['detail'] = 'totals';

  const pickWrap = back.querySelector('#dbmodal-pick');
  const optionEls = back.querySelectorAll<HTMLElement>('.dbmodal-opt');

  const sync = () => {
    optionEls.forEach(o => {
      o.classList.toggle('sel', o.dataset.period === selPeriod || o.dataset.detail === selDetail);
    });
    pickWrap?.classList.toggle('show', selPeriod === 'pick');
  };

  optionEls.forEach(o => {
    o.addEventListener('click', () => {
      if (o.dataset.period) selPeriod = o.dataset.period as PrintOptions['period'];
      if (o.dataset.detail) selDetail = o.dataset.detail as PrintOptions['detail'];
      sync();
    });
  });

  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  back.querySelector('#dbmodal-cancel')?.addEventListener('click', close);

  back.querySelector('#dbmodal-go')?.addEventListener('click', () => {
    const month = selPeriod === 'pick' && yearSel && monthSel ? `${yearSel.value}-${monthSel.value}` : '';
    close();
    void printDatabase({ period: selPeriod, month, detail: selDetail });
  });

  (back.querySelector('#dbmodal-go') as HTMLButtonElement | null)?.focus();
}

interface RoomMeta {
  number: string;
  buildingId: number;
  side: string | null;
  floor: number;
}

interface Group {
  building: string;
  buildingId: number;
  letter: string;
  period: string;
  bills: Bill[];
  byCell: Map<string, Bill>;
  months: string[];
  roomIds: number[];
  grand: number;
}

const BODY_BUDGET = 796;
const BAND_H = 40;
const DHEAD_H = 28;
const DROW_H = 23;
const DFOOT_H = 28;
const BAND_GAP = 12;
const DETAIL_ROWS = Math.floor((BODY_BUDGET - BAND_H - DHEAD_H - DFOOT_H) / DROW_H);

interface PagePlan {
  body: string;
  sig: boolean;
  cont: boolean;
}

interface SideSection {
  label: string | null;
  ids: Set<number>;
}

export async function printDatabase(opts: PrintOptions): Promise<void> {
  const [buildings, bills] = await Promise.all([api.getBuildings(), api.getAllBills()]);

  const billed = bills.filter(b => b.presReading != null && (b.total ?? 0) > 0);

  const roomMeta = new Map<number, RoomMeta>();
  for (const b of buildings) {
    for (const r of await api.getRooms(b.id)) {
      roomMeta.set(r.id, { number: r.number, buildingId: b.id, side: r.side ?? null, floor: r.floor ?? 0 });
    }
  }

  const pool = opts.period === 'pick' ? billed.filter(b => (b.month || '') === opts.month) : billed;
  if (pool.length === 0) {
    toast(opts.period === 'pick' ? `No completed bills for ${monthLabel(opts.month)}` : 'No completed bills in the database yet', 'warn');
    return;
  }

  const groups = new Map<string, Group>();
  for (const bill of pool) {
    const meta = roomMeta.get(bill.roomId);
    const buildingId = meta ? meta.buildingId : buildings[0]?.id ?? 1;
    const period = opts.period === 'pick' ? (bill.month || opts.month) : (bill.month || '').slice(0, 4) || '0000';
    const key = `${period}-${buildingId}`;
    if (!groups.has(key)) {
      const building = buildingName(buildingId, buildings);
      groups.set(key, {
        building,
        buildingId,
        letter: building.slice(0, 1).toUpperCase(),
        period,
        bills: [],
        byCell: new Map(),
        months: [],
        roomIds: [],
        grand: 0
      });
    }
    const g = groups.get(key)!;
    g.bills.push(bill);
    g.byCell.set(`${bill.roomId}|${bill.month}`, bill);
    g.grand += bill.total ?? 0;
  }

  const ordered = [...groups.values()].sort((a, b) => {
    if (opts.period === 'all' && a.period !== b.period) return a.period < b.period ? -1 : 1;
    return a.buildingId - b.buildingId;
  });

  for (const g of ordered) {
    g.months = opts.period === 'pick' ? [g.period] : [...new Set(g.bills.map(b => b.month))].sort();
    g.roomIds = sortRooms([...new Set(g.bills.map(b => b.roomId))], roomMeta);
  }

  const count = ordered.reduce((s, g) => s + g.bills.length, 0);
  const grandTotal = ordered.reduce((s, g) => s + g.grand, 0);
  void api.logEvent({ event: 'print_db', building: 'ALL', rooms: count, total: grandTotal });

  const plansByGroup = ordered.map(g => ({ g, plans: buildGroupPages(g, opts, roomMeta) }));
  const totalPages = plansByGroup.reduce((s, x) => s + x.plans.length, 0);

  const issued = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }).toUpperCase();
  let pageNo = 0;
  const pages = plansByGroup
    .map(({ g, plans }) => plans.map(p => renderPage(g, p, opts, ++pageNo, totalPages, issued)).join(''))
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>SioneloFlow - Water Billing Ledger</title>
<style>

  @page { size: 8.5in 11in; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; background: #fff; color: #000; font-family: "Courier New", Courier, monospace; }
  .page {
    width: 8.5in; height: 11in;
    padding: 18px 22px 14px;
    position: relative;
    page-break-after: always;
    display: flex; flex-direction: column;
  }

  @media print {
    .page { height: 100vh; max-height: 100vh; }
  }
  .page:last-child { page-break-after: avoid; }

  .corners i { position: absolute; width: 12px; height: 12px; border: 0 solid #000; }
  .corners i:nth-child(1) { top: 5px; left: 5px; border-top: 1.5px solid #000; border-left: 1.5px solid #000; }
  .corners i:nth-child(2) { top: 5px; right: 5px; border-top: 1.5px solid #000; border-right: 1.5px solid #000; }
  .corners i:nth-child(3) { bottom: 5px; left: 5px; border-bottom: 1.5px solid #000; border-left: 1.5px solid #000; }
  .corners i:nth-child(4) { bottom: 5px; right: 5px; border-bottom: 1.5px solid #000; border-right: 1.5px solid #000; }

  .p-head { flex: 0 0 auto; }
  .mast-box { border: 2px solid #000; padding: 8px 12px 9px; text-align: center; }
  .mast-kicker { font-size: 9px; letter-spacing: 5px; color: #555; font-weight: bold; }
  .mast-name { font-family: Georgia, 'Times New Roman', serif; font-size: 25px; font-weight: bold; letter-spacing: 6px; margin-top: 3px; }
  .mast-sub { font-size: 9.5px; letter-spacing: 3px; color: #444; margin-top: 3px; font-weight: bold; }
  .meta-row { display: flex; justify-content: space-between; align-items: baseline; font-size: 10px; font-weight: bold; letter-spacing: 1px; margin-top: 8px; }
  .meta-page { font-weight: normal; color: #555; letter-spacing: 2px; }

  .rule-set { margin-top: 7px; border-top: 3px solid #000; border-bottom: 1px solid #000; height: 4px; }

  .p-body { flex: 1 1 auto; min-height: 0; margin-top: 10px; }

  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  table th, table td { border: 1px solid #000; padding: 3px 6px; font-size: 10.5px; text-align: right; }
  thead th {
    font-size: 9.5px; letter-spacing: 1.5px; color: #444; font-weight: bold;
    background: #f2f2f2; border-bottom: 2px solid #000;
  }
  th.room, td.room { text-align: left; width: 70px; font-weight: bold; }
  td.amt { font-weight: bold; }
  td.na { color: #aaa; font-weight: normal; }

  tbody tr:nth-child(even) td, tbody tr:nth-child(even) th { background: #f8f8f8; }
  tfoot td, tfoot th { border-top: 2.5px solid #000; font-weight: bold; font-size: 11px; }
  tfoot th.vcol { outline: 2px solid #000; outline-offset: -1px; }
  tfoot th.tcol { outline: 2px solid #000; outline-offset: -1px; }
  th.vcol, td.vcol { width: 96px; }
  table.detail.totals { width: 58%; }

  .mon-band {
    display: flex; justify-content: space-between; align-items: baseline; gap: 10px;
    border: 1.5px solid #000; border-bottom: 2.5px solid #000;
    padding: 5px 8px; margin-top: 12px; background: #f2f2f2;
  }
  .p-body > .mon-band:first-child { margin-top: 0; }
  .mon-band .t { font-family: Georgia, 'Times New Roman', serif; font-size: 14px; font-weight: bold; letter-spacing: 2px; }
  .mon-band .s { font-size: 9px; letter-spacing: 1.5px; color: #555; font-weight: bold; white-space: nowrap; }
  table.detail { margin-top: 0; }
  th.tcol, td.tcol { width: 96px; }

  .p-foot { flex: 0 0 auto; margin-top: auto; padding-top: 12px; }
  .cont { text-align: right; font-size: 8.5px; letter-spacing: 2px; color: #666; font-weight: bold; margin-bottom: 4px; }
  .sig { display: flex; gap: 44px; }
  .sig-line { flex: 1; display: flex; align-items: flex-end; gap: 10px; font-size: 10px; font-weight: bold; letter-spacing: 1px; }
  .sig-dash { flex: 1; border-bottom: 1px solid #000; height: 1px; margin-bottom: 2px; }

  .brand-wrap { margin-top: 12px; border-top: 1px solid #000; border-bottom: 1px solid #000; height: 8px; }
  .brand-line { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 6px; font-size: 11px; font-weight: bold; letter-spacing: 3px; }
  .brand-line .bl-drop { width: 13px; height: 18px; flex: 0 0 auto; }
  .empty-note { text-align: center; font-size: 12px; color: #555; margin-top: 30px; }
</style>
</head>
<body>
  ${pages}
</body>
</html>`;

  openPrintFrame(html);
}

function openPrintFrame(html: string): void {
  let frame = document.getElementById('sf-print-frame') as HTMLIFrameElement | null;
  if (!frame) {
    frame = document.createElement('iframe');
    frame.id = 'sf-print-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;left:-9999px;top:0;width:8.5in;height:11in;border:0;';
    document.body.appendChild(frame);
  }
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) {
    toast('Cannot open the print view', 'err');
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  win.focus();

  if (printBusy) return;
  printBusy = true;
  const doPrint = () => {
    try { win.print(); } catch (e) { console.error('[print]', e); }

    window.setTimeout(() => { printBusy = false; }, 3000);
  };

  const schedule = () => { window.setTimeout(doPrint, 350); };
  if (doc.readyState === 'complete') schedule();
  else win.addEventListener('load', () => schedule(), { once: true });
}

let printBusy = false;

function buildGroupPages(g: Group, opts: PrintOptions, roomMeta: Map<number, RoomMeta>): PagePlan[] {

  const plans: PagePlan[] = [];
  let parts: string[] = [];
  let used = 0;
  const flush = () => {
    if (parts.length) {
      plans.push({ body: parts.join(''), sig: false, cont: true });
      parts = [];
      used = 0;
    }
  };

  const hasSides = g.roomIds.some(rid => roomMeta.get(rid)?.side);
  const sideSections: SideSection[] = [];
  if (hasSides) {
    const a = new Set(g.roomIds.filter(rid => roomMeta.get(rid)?.side === 'A'));
    const b = new Set(g.roomIds.filter(rid => roomMeta.get(rid)?.side === 'B'));
    const other = new Set(g.roomIds.filter(rid => !roomMeta.get(rid)?.side));
    if (a.size) sideSections.push({ label: 'A', ids: a });
    if (b.size) sideSections.push({ label: 'B', ids: b });

    if (other.size) sideSections.push({ label: null, ids: other });
  }

  const packMonth = (m: string, rows: string[], side: SideSection | null, forceNewPage: boolean) => {
    if (rows.length === 0) return;
    const secH = BAND_H + DHEAD_H + rows.length * DROW_H + DFOOT_H;
    if (forceNewPage) flush();

    if (used > 0 && used + BAND_GAP + secH <= BODY_BUDGET) {
      parts.push(monthSection(g, m, rows, true, true, opts, side));
      used += BAND_GAP + secH;
    } else if (secH <= BODY_BUDGET) {
      flush();
      parts.push(monthSection(g, m, rows, true, true, opts, side));
      used = secH;
    } else {

      flush();
      const remaining = [...rows];
      let first = true;
      while (remaining.length > 0) {
        const part = remaining.splice(0, DETAIL_ROWS);
        flush();
        parts.push(monthSection(g, m, part, first, remaining.length === 0, opts, side));
        used = BAND_H + DHEAD_H + part.length * DROW_H + (remaining.length === 0 ? DFOOT_H : 0);
        first = false;
      }
    }
  };

  for (const m of g.months) {
    if (hasSides) {
      for (const side of sideSections) {

        packMonth(m, detailRows(g, m, roomMeta, opts, side.ids), side, true);
      }
    } else {
      packMonth(m, detailRows(g, m, roomMeta, opts), null, false);
    }
  }
  flush();

  if (plans.length === 0) {
    plans.push({ body: '<p class="empty-note">No billed rooms for this period.</p>', sig: true, cont: false });
  }

  plans[plans.length - 1].sig = true;
  plans[plans.length - 1].cont = false;
  return plans;
}

function roomNumber(rid: number, roomMeta: Map<number, RoomMeta>): string {
  return roomMeta.get(rid)?.number ?? String(rid);
}

function detailRows(g: Group, m: string, roomMeta: Map<number, RoomMeta>, opts: PrintOptions, ids?: Set<number>): string[] {
  const wanted = ids ? g.roomIds.filter(rid => ids.has(rid)) : g.roomIds;
  return wanted
    .filter(rid => g.byCell.has(`${rid}|${m}`))
    .map(rid => {
      const b = g.byCell.get(`${rid}|${m}`)!;

      if (opts.detail === 'totals') {
        return `<tr>
          <th class="room">${roomNumber(rid, roomMeta)}</th>
          <td class="amt vcol">${money(b.subtotal ?? 0)}</td>
          <td class="amt tcol">${money(b.total ?? 0)}</td>
        </tr>`;
      }

      return `<tr>
        <th class="room">${roomNumber(rid, roomMeta)}</th>
        <td>${fmtRead(b.presReading)}</td>
        <td>${fmtRead(b.prevReading)}</td>
        <td>${fmtRead(b.consumption)}</td>
        <td>${money2(b.rate)}</td>
        <td class="amt vcol">${money(b.subtotal ?? 0)}</td>
        <td>${money(b.surcharge)}</td>
        <td class="amt tcol">${money(b.total ?? 0)}</td>
      </tr>`;
    });
}

function monthSection(g: Group, m: string, rows: string[], first: boolean, lastOfMonth: boolean, opts: PrintOptions, side: SideSection | null): string {

  const prefix = side && side.label ? `BUILDING ${side.label} · ` : '';
  const band = first
    ? `<div class="mon-band"><span class="t">${monthFull(m)}</span><span class="s">${prefix}${bandMeta(g, m)}</span></div>`
    : `<div class="mon-band"><span class="t">${monthFull(m)}</span><span class="s">${prefix}CONTINUED</span></div>`;
  const ids = side ? side.ids : null;

  const tfoot = lastOfMonth
    ? (opts.detail === 'totals'
        ? `<tfoot><tr><th class="room">TOTAL</th><th class="amt vcol">${money(monthVol(g, m, ids))}</th><th class="amt tcol">${money(monthTotal(g, m, ids))}</th></tr></tfoot>`
        : `<tfoot><tr><th class="room">TOTAL</th><td colspan="4"></td><th class="amt vcol">${money(monthVol(g, m, ids))}</th><td></td><th class="amt tcol">${money(monthTotal(g, m, ids))}</th></tr></tfoot>`)
    : '';
  const head = opts.detail === 'totals'
    ? '<thead><tr><th class="room">ROOM</th><th class="vcol">VOLUMETRIC</th><th class="tcol">TOTAL</th></tr></thead>'
    : '<thead><tr><th class="room">ROOM</th><th>PRESENT</th><th>PREVIOUS</th><th>CONSUMPTION</th><th>RATE</th><th class="vcol">VOLUMETRIC</th><th>SURCHARGE</th><th class="tcol">TOTAL</th></tr></thead>';
  return `${band}<table class="detail ${opts.detail === 'totals' ? 'totals' : 'full'}">
    ${head}
    <tbody>${rows.join('')}</tbody>${tfoot}</table>`;
}

function monthTotal(g: Group, m: string, ids?: Set<number> | null): number {
  return g.bills.filter(b => b.month === m && (!ids || ids.has(b.roomId))).reduce((s, b) => s + (b.total ?? 0), 0);
}

function monthVol(g: Group, m: string, ids?: Set<number> | null): number {
  return g.bills.filter(b => b.month === m && (!ids || ids.has(b.roomId))).reduce((s, b) => s + (b.subtotal ?? 0), 0);
}

function bandMeta(g: Group, m: string): string {
  const b = g.bills.find(x => x.month === m && x.rate > 0) ?? g.bills.find(x => x.month === m);
  return b ? `RATE ${money2(b.rate)}/M³ · SURCHARGE ${money(b.surcharge)}` : '';
}

function renderPage(g: Group, plan: PagePlan, opts: PrintOptions, pageNo: number, totalPages: number, issued: string): string {
  const label = opts.period === 'pick'
    ? `MONTHLY LEDGER · ${monthFull(g.period)}`
    : `YEAR ${g.period} · ALL TOTALS IN PHILIPPINE PESOS (₱)`;
  const ledgerNo = opts.period === 'pick'
    ? `${g.letter}-${g.period.replace('-', '')}`
    : `${g.letter}-${g.period}`;
  const sig = plan.sig ? `
    <div class="sig">
      <div class="sig-line"><span>PREPARED BY</span><i class="sig-dash"></i></div>
      <div class="sig-line"><span>CHECKED &amp; RECEIVED BY</span><i class="sig-dash"></i></div>
    </div>` : '';
  const cont = plan.cont ? '<div class="cont">Continued on next page &#8594;</div>' : '';
  return `
  <div class="page">
    <div class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="p-head">
      <div class="mast-box">
        <div class="mast-kicker">OFFICIAL WATER BILLING LEDGER</div>
        <div class="mast-name">${g.building.toUpperCase()} RESIDENCE</div>
        <div class="mast-sub">${label}</div>
      </div>
      <div class="meta-row">
        <span class="meta-led">LEDGER NO. ${ledgerNo}</span>
        <span class="meta-page">PAGE ${pageNo} OF ${totalPages}</span>
        <span class="meta-issued">ISSUED ${issued}</span>
      </div>
      <div class="rule-set"></div>
    </div>
    <div class="p-body">${plan.body}</div>
    <div class="p-foot">
      ${cont}
      ${sig}
      <div class="brand-wrap"></div>
      <div class="brand-line"><span>POWERED BY SIONELOFLOW - WATER BILLING ENGINE</span><svg class="bl-drop" viewBox="${DROP_VIEWBOX}" fill="#000" stroke="none"><path d="${DROP_ICON}"/></svg></div>
    </div>
  </div>`;
}

function sortRooms(ids: number[], roomMeta: Map<number, RoomMeta>): number[] {
  return [...ids].sort((a, b) => {
    const ma = roomMeta.get(a), mb = roomMeta.get(b);
    const as = ma?.side ?? null, bs = mb?.side ?? null;
    if (as !== bs) {
      if (as === 'A') return -1;
      if (bs === 'A') return 1;
      if (as === 'B') return -1;
      return 1;
    }
    const af = ma?.floor ?? 0, bf = mb?.floor ?? 0;
    if (af !== bf) return af - bf;
    const an = parseInt(ma?.number ?? '0', 10) || 0;
    const bn = parseInt(mb?.number ?? '0', 10) || 0;
    if (an !== bn) return an - bn;
    return (ma?.number ?? '') < (mb?.number ?? '') ? -1 : 1;
  });
}

function buildingName(id: number, buildings: { id: number; name: string }[]): string {
  return buildings.find(b => b.id === id)?.name ?? `Building ${id}`;
}

function fmtRead(n: number | null): string {
  return n == null ? 'N/A' : n.toLocaleString('en-PH', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function money2(n: number): string {
  return '₱' + n.toFixed(2);
}

function monthFull(m: string): string {
  return monthLabel(m).toUpperCase();
}
