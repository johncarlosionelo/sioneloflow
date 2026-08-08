
import { computeBill, monthLabel, money, orderRooms } from '../engine';
import { state } from '../state';
import { toast } from './toast';
import { billFor } from './cards';
import { api } from '../db';
import { DROP_ICON, DROP_VIEWBOX } from '../logo';

const CODE39_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%*';

const CODE39_VALUES = [
  20957, 29783, 23639, 30485, 20951, 29813, 23669, 20855, 29789, 23645,
  29975, 23831, 30533, 22295, 30149, 24005, 21623, 29981, 23837, 22301,
  30023, 23879, 30545, 22343, 30161, 24017, 21959, 30065, 23921, 22385,
  29015, 18263, 29141, 17879, 29045, 18293, 17783, 29021, 18269, 17477,
  17489, 17681, 20753, 35770
];

function code39Elements(ch: string): number[] {
  const idx = CODE39_CHARS.indexOf(ch);
  const bin = CODE39_VALUES[idx].toString(2);
  const widths: number[] = [];
  let run = 1;
  for (let i = 1; i <= bin.length; i++) {
    if (i === bin.length || bin[i] !== bin[i - 1]) { widths.push(run); run = 1; } else run++;
  }
  return widths;
}

function barcodeHTML(code: string): string {
  const cleaned = code.toUpperCase().split('').filter(c => CODE39_CHARS.indexOf(c) !== -1).join('');
  if (!cleaned) return '<div class="barcode"></div>';

  const seq: Array<{ bar: boolean; w: number }> = [];
  const pushChar = (ch: string) => {
    const els = code39Elements(ch);
    els.forEach((w, i) => seq.push({ bar: i % 2 === 0, w }));
  };
  pushChar('*');
  for (const c of cleaned) { pushChar(c); seq.push({ bar: false, w: 1 }); }
  pushChar('*');

  const U = 1.0;
  const html = seq.map(e => `<i${e.bar ? ' class="b"' : ''} style="width:${Math.round(e.w * U)}px"></i>`).join('');
  return `<div class="barcode">${html}</div><div class="bc-label">${cleaned}</div>`;
}

export function openSlipsDialog(): void {
  if (document.getElementById('slipmodal-back')) return;
  const { rooms, month, buildingName } = state.get();

  const period = `${monthLabel(month).toUpperCase()}`;
  const ordered = orderRooms(rooms);

  const hasSides = ordered.some(r => r.side);
  const groups = hasSides
    ? [
        { label: 'BUILDING A', rooms: ordered.filter(r => r.side === 'A') },
        { label: 'BUILDING B', rooms: ordered.filter(r => r.side === 'B') },
        { label: null, rooms: ordered.filter(r => !r.side) }
      ].filter(g => g.rooms.length > 0)
    : [{ label: null, rooms: ordered }];
  let groupsHtml = '';
  let printable = 0;
  for (const g of groups) {
    let tiles = '';
    for (const room of g.rooms) {
      const bill = billFor(room);
      const ok = !!bill && bill.presReading != null;
      if (ok) printable++;
      tiles += ok
        ? `<button type="button" class="slip-tile" data-id="${room.id}" title="Room ${room.number}">${room.number}</button>`
        : `<button type="button" class="slip-tile off" data-id="${room.id}" disabled title="No reading for ${period}"><span class="tile-x">✕</span><span class="tile-num">${room.number}</span></button>`;
    }
    groupsHtml += `<div class="slipgroup">${g.label ? `<div class="slipgroup-head">${g.label}</div>` : ''}<div class="slipgrid">${tiles}</div></div>`;
  }
  const offCount = ordered.length - printable;

  const back = document.createElement('div');
  back.className = 'dbmodal-back';
  back.id = 'slipmodal-back';
  back.innerHTML = `
  <div class="dbmodal slipmodal" role="dialog" aria-modal="true" aria-label="Print receipt slits">
    <div class="dbmodal-mark"><svg viewBox="${DROP_VIEWBOX}" fill="currentColor" stroke="none"><path d="${DROP_ICON}"/></svg></div>
    <h2 class="dbmodal-title">Print Receipt Slits</h2>
    <p class="dbmodal-sub">${buildingName} Residence · ${monthLabel(month)} — black-and-white, print-ready.</p>

    <div class="dbmodal-label">1 · Rooms</div>
    <div class="dbmodal-grid">
      <button type="button" class="dbmodal-opt sel" data-mode="all">
        <span class="opt-title">All rooms</span>
        <span class="opt-desc">Every room with a reading gets a slip.</span>
      </button>
      <button type="button" class="dbmodal-opt" data-mode="pick">
        <span class="opt-title">Select rooms only</span>
        <span class="opt-desc">Starts empty — tap numbers to pick the exact slips.</span>
      </button>
    </div>

    <div class="slipgrid-wrap" id="slipgrid-wrap">
      <div class="slipgrid-bar">
        <span class="slipgrid-count" id="slipgrid-count"></span>
        <span class="slipgrid-links">
          <button type="button" class="slipgrid-link" id="slipgrid-all">All</button>
          <button type="button" class="slipgrid-link" id="slipgrid-none">None</button>
        </span>
      </div>
      ${groupsHtml}
      ${offCount > 0 ? `<p class="slipgrid-note">Rooms marked <b>✕</b> have no present reading for <b>${period}</b> — they can't be printed yet.</p>` : ''}
    </div>

    <div class="dbmodal-label">2 · Copies</div>
    <label class="dbmodal-copies" for="slipmodal-copies">
      <input type="checkbox" id="slipmodal-copies" checked />
      <span class="copies-box" aria-hidden="true"></span>
      <span class="copies-text">
        <span class="copies-title">Print 2 copies — one for you, one for the tenant</span>
        <span class="copies-desc">Each slip is stamped OFFICIAL OFFICE COPY / OFFICIAL TENANT COPY so nobody can dispute whose slip is whose. Uncheck to pick a single-copy type instead.</span>
      </span>
    </label>

    <div class="copies-opts" id="copies-opts">
      <button type="button" class="dbmodal-opt copies-opt sel" data-copy="office">
        <span class="opt-title">Office copy</span>
        <span class="opt-desc">Stamped OFFICIAL OFFICE COPY — your records.</span>
      </button>
      <button type="button" class="dbmodal-opt copies-opt" data-copy="tenant">
        <span class="opt-title">Tenant copy</span>
        <span class="opt-desc">Stamped OFFICIAL TENANT COPY — hand to the tenant.</span>
      </button>
      <button type="button" class="dbmodal-opt copies-opt warn" data-copy="none">
        <span class="opt-title">No copy label</span>
        <span class="opt-desc">Plain slip — nobody's name on it.</span>
      </button>
    </div>

    <div class="dbmodal-actions">
      <button type="button" class="dbmodal-cancel" id="slipmodal-cancel">Cancel</button>
      <button type="button" class="dbmodal-go" id="slipmodal-go">Print Slips</button>
    </div>
  </div>`;
  document.body.appendChild(back);

  const selected = new Set<number>();
  const allIds = new Set<number>();
  const tileEls = back.querySelectorAll<HTMLButtonElement>('.slip-tile');
  tileEls.forEach(t => {
    if (t.disabled) return;
    allIds.add(Number(t.dataset.id));
  });
  let mode: 'all' | 'pick' = 'all';

  const gridWrap = back.querySelector('#slipgrid-wrap') as HTMLElement;
  const countEl = back.querySelector('#slipgrid-count') as HTMLElement;
  const goBtn = back.querySelector('#slipmodal-go') as HTMLButtonElement;
  const optionEls = back.querySelectorAll<HTMLElement>('.dbmodal-opt');

  const sync = () => {
    optionEls.forEach(o => o.classList.toggle('sel', o.dataset.mode === mode));
    gridWrap.classList.toggle('show', mode === 'pick');
    tileEls.forEach(t => t.classList.toggle('sel', selected.has(Number(t.dataset.id))));
    const n = mode === 'pick' ? selected.size : allIds.size;
    countEl.textContent = `${n} of ${allIds.size} selected`;
    if (mode === 'pick' && selected.size === 0) {
      goBtn.disabled = true;
      goBtn.textContent = 'Select a room';
    } else {
      goBtn.disabled = false;
      goBtn.textContent = `Print Slips · ${n}`;
    }
  };
  sync();

  optionEls.forEach(o => o.addEventListener('click', () => {
    mode = (o.dataset.mode as 'all' | 'pick') || 'all';
    sync();
  }));
  tileEls.forEach(t => t.addEventListener('click', () => {
    const id = Number(t.dataset.id);
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    sync();
  }));
  back.querySelector('#slipgrid-all')?.addEventListener('click', () => {
    allIds.forEach(id => selected.add(id));
    sync();
  });
  back.querySelector('#slipgrid-none')?.addEventListener('click', () => {
    selected.clear();
    sync();
  });

  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  back.querySelector('#slipmodal-cancel')?.addEventListener('click', close);

  const copiesEl = back.querySelector('#slipmodal-copies') as HTMLInputElement;
  const copiesOpts = back.querySelector('#copies-opts') as HTMLElement;
  const copyOptEls = back.querySelectorAll<HTMLElement>('.copies-opt');
  let copyChoice: 'office' | 'tenant' | 'none' = 'office';

  const syncCopies = () => {
    copiesOpts.classList.toggle('show', !copiesEl.checked);
    copyOptEls.forEach(o => o.classList.toggle('sel', o.dataset.copy === copyChoice));
  };
  copiesEl.addEventListener('change', syncCopies);
  copyOptEls.forEach(o => o.addEventListener('click', () => {
    copyChoice = (o.dataset.copy as 'office' | 'tenant' | 'none') || 'office';
    syncCopies();
  }));
  syncCopies();

  const openNoCopyWarn = (onPrint: () => void) => {
    const w = document.createElement('div');
    w.className = 'dbmodal-back';
    w.id = 'slip-warn-back';
    w.innerHTML = `
    <div class="dbmodal warnmodal" role="alertdialog" aria-modal="true" aria-label="No copy label">
      <div class="dbmodal-mark warn-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <h2 class="dbmodal-title">No copy label?</h2>
      <p class="dbmodal-sub">This slip carries no OFFICIAL stamp, so nothing on paper says whether it's your office copy or the tenant's. A tenant could claim you kept their slip. Print it anyway?</p>
      <div class="dbmodal-actions">
        <button type="button" class="dbmodal-cancel" id="slip-warn-cancel">Cancel</button>
        <button type="button" class="dbmodal-go warn-go" id="slip-warn-go">Print anyway</button>
      </div>
    </div>`;
    document.body.appendChild(w);
    document.removeEventListener('keydown', onKey);
    const closeW = () => {
      w.remove();
      document.removeEventListener('keydown', onWarnKey);
      document.addEventListener('keydown', onKey);
    };
    const onWarnKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeW();
    };
    document.addEventListener('keydown', onWarnKey);
    w.querySelector('#slip-warn-cancel')?.addEventListener('click', closeW);
    w.querySelector('#slip-warn-go')?.addEventListener('click', () => {
      w.remove();
      document.removeEventListener('keydown', onWarnKey);
      onPrint();
    });
    (w.querySelector('#slip-warn-go') as HTMLButtonElement).focus();
  };

  back.querySelector('#slipmodal-go')?.addEventListener('click', () => {
    const rooms = mode === 'pick' ? new Set(selected) : undefined;
    if (copiesEl.checked) { close(); printSlips(rooms, 'both'); return; }
    if (copyChoice === 'none') {
      openNoCopyWarn(() => { close(); printSlips(rooms, null); });
      return;
    }
    close();
    printSlips(rooms, copyChoice);
  });
  goBtn.focus();
}

export function printSlips(roomIds?: Set<number>, copy?: 'both' | 'office' | 'tenant' | null): void {
  const { rooms, month, rate, surcharge, buildingName } = state.get();

  const doBoth = copy === 'both';

  let pageHtml = '';
  let payload = '';
  let count = 0;

  const issued = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });

  const ordered = orderRooms(rooms);

  for (const room of ordered) {
    if (roomIds && !roomIds.has(room.id)) continue;
    const bill = billFor(room);
    if (!bill || bill.presReading == null) continue;

    const { consumption, subtotal, total } = computeBill(bill.prevReading, bill.presReading, rate, surcharge);

    const serial = `${buildingName.slice(0, 1).toUpperCase()}-${room.number}-${month.replace('-', '')}`;

    const presReading = bill.presReading;

    const emit = (copy: 'office' | 'tenant' | null) => {
      pageHtml += `
      <div class="slip">
        <div class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        ${copy ? `<div class="copy-band ${copy}">${copy === 'office' ? 'OFFICIAL OFFICE COPY · FOR ADMINISTRATION RECORDS' : 'OFFICIAL TENANT COPY · KEEP FOR YOUR RECORDS'}</div>` : ''}
        <div class="slip-head">
          <div class="mast-name">${buildingName.toUpperCase()} RESIDENCE</div>
          <div class="mast-sub">Statement of Water Account</div>
        </div>
        <div class="hr-double"></div>
        <div class="meta">
          <span>NO. ${serial}</span>
          <span>ISSUED ${issued}</span>
        </div>
        <div class="meta-note">KEEP THIS RECEIPT FOR YOUR RECORDS</div>
        <div class="hr-dashed"></div>
        <div class="l-row"><span class="lab">ROOM NO</span><span class="dot"></span><b>${room.number}</b></div>
        <div class="l-row"><span class="lab">PERIOD</span><span class="dot"></span><b>${monthLabel(month).toUpperCase()}</b></div>
        <div class="hr-dashed"></div>
        <div class="l-row"><span class="lab">PRESENT READING</span><span class="dot"></span><b>${presReading.toFixed(1)} m³</b></div>
        <div class="l-row"><span class="lab">PREVIOUS READING</span><span class="dot"></span><b>${bill.prevReading == null ? 'N/A' : bill.prevReading.toFixed(1)} m³</b></div>
        <div class="l-row"><span class="lab">NET CONSUMPTION</span><span class="dot"></span><b>${consumption.toFixed(1)} m³</b></div>
        <div class="hr-dashed"></div>
        <div class="l-row"><span class="lab">UNIT RATE</span><span class="dot"></span><b>₱${rate.toFixed(2)}/m³</b></div>
        <div class="hr-dashed"></div>
        <div class="l-row"><span class="lab">VOLUMETRIC CHARGE</span><span class="dot"></span><b>${money(subtotal)}</b></div>
        <div class="l-row"><span class="lab">E MOTOR SURCHARGE</span><span class="dot"></span><b>+${money(surcharge)}</b></div>
        <div class="hr-double"></div>
        <div class="total-box">
          <span class="t-lab">TOTAL AMOUNT DUE</span>
          <span class="t-val">${money(total)}</span>
        </div>
        <div class="hr-double"></div>
        <div class="bc-zone">
          <div class="bc-note">THIS BARCODE IS YOUR BILL REFERENCE</div>
          ${barcodeHTML(serial)}
        </div>
        <div class="slip-foot">
          <span class="slip-stamp">UNPAID</span>
          <div class="slip-sig"><span>RECEIVED BY</span></div>
        </div>
        <div class="slip-brand">
          <div class="brand-rule"></div>
          <div class="brand-inner">
            <span>POWERED BY SIONELOFLOW</span>
            <svg viewBox="${DROP_VIEWBOX}" fill="#000" stroke="none" aria-hidden="true"><path d="${DROP_ICON}"/></svg>
          </div>
        </div>
      </div>`;
      count++;

      if (count % 4 === 0) {
        payload += `<div class="page"><div class="grid">${pageHtml}</div></div>`;
        pageHtml = '';
      }
    };

    if (doBoth) { emit('office'); emit('tenant'); }
    else if (copy === 'office' || copy === 'tenant') emit(copy);
    else emit(null);
  }

  if (pageHtml !== '') {
    payload += `<div class="page"><div class="grid">${pageHtml}</div></div>`;
  }

  if (count === 0) {
    toast('No present readings in this building yet', 'warn');
    return;
  }

  void api.logEvent({
    event: 'print',
    building: buildingName,
    month,
    rate,
    surcharge,
    rooms: count
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Print Slits · ${buildingName} Residence</title>
      <style>

        @page { size: 8.5in 11in; margin: 0; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { width: 100%; background: #fff; color: #000; font-family: "Courier New", Courier, monospace; }
        .page {
          width: 8.5in; height: 11in;
          padding: 0.3in;
          page-break-after: always;
        }
        @media print {
          .page { height: 100vh; max-height: 100vh; }
        }
        .page:last-child { page-break-after: avoid; }
        .grid {
          height: 100%;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          grid-template-rows: repeat(2, 1fr);
          gap: 0.25in;
        }
        .slip {
          position: relative;
          height: 100%;
          border: 1px dashed #000;
          padding: 10px 14px;
          display: flex; flex-direction: column;
          overflow: hidden;
        }

        .copy-band {
          background: #000;
          color: #fff;
          font-size: 7px;
          font-weight: bold;
          letter-spacing: 2px;
          text-align: center;
          padding: 3px 0;
          margin: 0 0 5px;
        }

        .corners i {
          position: absolute; width: 9px; height: 9px;
          border: 0 solid #000;
        }
        .corners i:nth-child(1) { top: 4px; left: 4px; border-top: 1.5px solid #000; border-left: 1.5px solid #000; }
        .corners i:nth-child(2) { top: 4px; right: 4px; border-top: 1.5px solid #000; border-right: 1.5px solid #000; }
        .corners i:nth-child(3) { bottom: 4px; left: 4px; border-bottom: 1.5px solid #000; border-left: 1.5px solid #000; }
        .corners i:nth-child(4) { bottom: 4px; right: 4px; border-bottom: 1.5px solid #000; border-right: 1.5px solid #000; }

        .slip-head { border: 1.5px solid #000; padding: 5px 6px 4px; margin-bottom: 0; }
        .mast-name { font-family: Georgia, 'Times New Roman', serif; font-size: 16px; font-weight: bold; letter-spacing: 3px; text-align: center; }

        .mast-sub { font-size: 8.5px; letter-spacing: 2.5px; text-align: center; margin-top: 1px; color: #555; }

        .hr-double { border-top: 2.5px solid #000; height: 2px; border-bottom: 1px solid #000; margin: 3px 0; }
        .hr-dashed { border-top: 1px dashed #000; margin: 3px 0; }

        .meta {
          display: flex; justify-content: space-between;
          font-size: 8.5px; font-weight: bold; letter-spacing: 1px;
        }

        .meta-note { text-align: center; font-size: 7px; letter-spacing: 2px; margin-top: 10px; color: #666; }

        .l-row { display: flex; align-items: baseline; font-size: 12.5px; line-height: 1.42; }
        .l-row .lab { font-weight: bold; font-size: 9.5px; letter-spacing: 1px; white-space: nowrap; color: #555; }
        .l-row .dot { flex: 1; border-bottom: 1px dotted #555; margin: 0 5px; min-width: 8px; }
        .l-row b { font-weight: bold; white-space: nowrap; }

        .total-box {
          border: 1.5px solid #000;
          outline: 1px solid #000; outline-offset: 2px;
          padding: 3px 10px 4px;
          margin: 2px 0 2px;
          display: flex; flex-direction: column;
        }
        .t-lab { font-size: 9px; font-weight: bold; letter-spacing: 2px; text-align: center; }
        .t-val { font-size: 19px; font-weight: bold; letter-spacing: 1px; text-align: center; line-height: 1.12; }

        .bc-zone { display: flex; flex-direction: column; align-items: center; margin: auto 0; }
        .barcode { display: flex; height: 20px; }
        .barcode i { display: block; height: 100%; }
        .barcode .b { background: #000; }
        .bc-label { font-size: 7px; font-weight: bold; letter-spacing: 2px; margin-top: 6px; }
        .bc-note { text-align: center; font-size: 6.5px; letter-spacing: 2px; margin-bottom: 5px; color: #666; }

        .slip-foot {
          margin-top: 12px;
          display: flex; justify-content: space-between; align-items: flex-end;
          padding-top: 4px;
        }

        .slip-stamp {
          border: 2px solid #000;
          outline: 1px solid #000; outline-offset: 2px;
          padding: 2px 10px;
          font-size: 11px; font-weight: bold; letter-spacing: 3px;
          transform: rotate(-6deg);
        }
        .slip-sig { width: 160px; border-top: 1.5px solid #000; text-align: center; padding-top: 4px; font-size: 8.5px; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; }

        .slip-brand { margin-top: auto; }
        .brand-rule {
          height: 1px;
          background-image: repeating-linear-gradient(90deg, #000 0 3px, transparent 3px 6px);
          margin: 0 0 6px;
        }
        .brand-inner {
          display: flex; align-items: center; justify-content: center; gap: 5px;
        }
        .brand-inner svg { width: 10px; height: 12px; flex: none; }
        .brand-inner span {
          font-size: 8px; font-weight: bold; letter-spacing: 2.5px; color: #000;
        }
      </style>
    </head>
    <body>
      ${payload}
    </body>
    </html>
  `;

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
