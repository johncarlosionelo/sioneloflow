
import type { Bill, Room } from '../engine';
import { computeBill, money, reading } from '../engine';
import { state } from '../state';
import { safeMessage } from '../errors';
import { DROP_ICON, DROP_VIEWBOX } from '../logo';

const dirty = new Set<string>();

let cleanSig = '';
let cleanRate = 0;

function currentSig(): string {
  const st = state.get();
  return JSON.stringify({ bills: st.bills, rate: st.rate });
}

export function markClean(): void {
  cleanSig = currentSig();
  cleanRate = state.get().rate;
  emitUnsaved();
}

export function hasUnsaved(): boolean {
  return currentSig() !== cleanSig;
}

export function unsavedCount(): number {
  const st = state.get();
  let n = dirty.size;
  if (st.rate !== cleanRate) n += 1;
  return n;
}

type UnsavedListener = (count: number) => void;
const unsavedListeners = new Set<UnsavedListener>();

export function onUnsavedChange(fn: UnsavedListener): void {
  unsavedListeners.add(fn);
  fn(unsavedCount());
}

export function emitUnsaved(): void {
  const n = unsavedCount();
  unsavedListeners.forEach(fn => fn(n));
}

let deckOwner = 0;
let deckBusy = false;
const OVERLAY_OUT_MS = 280;

function lockScroll(): void {

  document.documentElement.classList.add('loading-lock');
  document.body.classList.add('loading-lock');
}

function unlockScroll(): void {
  document.documentElement.classList.remove('loading-lock');
  document.body.classList.remove('loading-lock');
}

function spinnerInner(message: string): string {
  return `
    <div class="load-orbit">
      <span class="load-ring"></span>
      <svg class="load-drop" viewBox="${DROP_VIEWBOX}" fill="currentColor" stroke="none"><path d="${DROP_ICON}"/></svg>
    </div>
    <div class="load-copy">
      <p class="load-title">Please wait</p>
      <p class="load-msg">${message}</p>
    </div>`;
}

export function deckLoading(message?: string): Promise<number> {
  const msg = message ?? 'Gathering data…';
  const existing = document.querySelector('.full-loader');
  if (existing) {

    const token = ++deckOwner;
    deckBusy = true;
    existing.classList.remove('out');
    existing.innerHTML = spinnerInner(msg);
    return Promise.resolve(token);
  }
  const token = ++deckOwner;
  deckBusy = true;
  lockScroll();
  const el = document.createElement('div');
  el.className = 'full-loader';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = spinnerInner(msg);
  document.body.appendChild(el);
  return Promise.resolve(token);
}

export function deckReady(owner: number): Promise<boolean> {
  const overlay = document.querySelector('.full-loader');
  if (!overlay || owner !== deckOwner) return Promise.resolve(false);
  deckOwner++;
  return new Promise(resolve => {
    overlay.classList.add('out');
    setTimeout(() => {
      const finalized = deckOwner === owner + 1;
      if (finalized) {
        overlay.remove();
        unlockScroll();
        deckBusy = false;
      }
      resolve(finalized);
    }, OVERLAY_OUT_MS);
  });
}

export function deckError(owner: number, message: string, onRetry?: () => void, prefix = "Couldn't load readings:"): void {
  const overlay = document.querySelector('.full-loader');
  if (!overlay || owner !== deckOwner) return;
  deckOwner++;
  deckBusy = false;
  overlay.classList.remove('out');
  overlay.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'load-error';
  box.setAttribute('role', 'alert');
  const icon = document.createElement('div');
  icon.className = 'error-icon';
  icon.textContent = '!';
  const p = document.createElement('p');

  p.textContent = `${prefix} ${safeMessage(message)}`;
  box.append(icon, p);
  if (onRetry) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'error-retry';
    btn.textContent = 'Try again';
    btn.addEventListener('click', onRetry);
    box.appendChild(btn);
  }
  overlay.appendChild(box);
}

export function isDeckOwner(token: number): boolean {
  return token === deckOwner;
}

export function deckSwapping(): boolean {
  return deckBusy;
}

export function cardKey(roomId: number, month: string): string {
  return `${roomId}:${month}`;
}

function billFor(room: Room): Bill | undefined {
  return state.get().bills[cardKey(room.id, state.get().month)];
}

export { billFor };

export function renderCards(container: HTMLElement, quiet = false): void {
  const { rooms, floor, bills } = state.get();
  const visible = rooms.filter(r => r.floor === floor);

  container.classList.toggle('deck-swap-in', !quiet);
  container.innerHTML = '';
  dirty.clear();

  if (visible.length === 0) {
    container.innerHTML = `<div class="empty-floor"><div class="empty-icon">◍</div><p>No rooms on this floor.</p></div>`;
    return;
  }

  let i = 0;
  for (const group of groupBySide(visible)) {
    if (group.label) {
      const head = document.createElement('div');
      head.className = 'section-head';
      head.textContent = group.label;
      head.style.setProperty('--i', String(i++));
      container.appendChild(head);
    }
    for (const room of group.rooms) {
    const bill = bills[cardKey(room.id, state.get().month)];

    const prev = bill?.prevReading;
    const pres = bill?.presReading ?? '';

    const card = document.createElement('article');
    card.className = 'room-card';
    card.dataset.room = String(room.id);
    card.innerHTML = `
      <div class="room-head">
        <div class="room-id">
          <span class="room-kicker">ROOM</span>
          <span class="room-num">${room.number}</span>
          ${room.side ? `<span class="chip chip-side">${room.side === 'A' ? 'Left Bldg' : 'Right Bldg'}</span>` : ''}
          ${room.wing ? `<span class="chip chip-gate">Gate Wing</span>` : ''}
        </div>
        <div class="room-head-right">
          <span class="save-dot" data-save></span>
        </div>
      </div>
      <div class="room-fields">
        <div class="field">
          <label>Previous</label>
          <div class="field-value prev">
            <svg class="prev-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span class="prev-val">${reading(prev)}</span>
          </div>
        </div>
        <div class="field">
          <label>Present Reading</label>
          <div class="pres-wrap">
            <input type="text" inputmode="decimal" autocomplete="off" spellcheck="false"
              class="pres-input" data-pres data-room="${room.id}"
              value="${pres === '' ? '' : pres}" placeholder="—" />
          </div>
        </div>
      </div>
      <div class="room-math" data-math>
        <div class="math-break" data-math-break></div>
        <div class="math-total-row">
          <span class="math-total-label">Total due</span>
          <span class="math-total" data-math-total>₱0</span>
        </div>
      </div>
    `;

    card.style.setProperty('--i', String(i++));
    container.appendChild(card);

    const presInput = card.querySelector('[data-pres]') as HTMLInputElement;
    presInput.addEventListener('input', () => {

      const raw = presInput.value;
      let clean = '';
      let dot = false;
      for (const ch of raw) {
        if (ch >= '0' && ch <= '9') { clean += ch; continue; }
        if (ch === '.' && !dot) { clean += ch; dot = true; }
      }
      if (clean !== raw) {
        const pos = presInput.selectionStart ?? raw.length;
        presInput.value = clean;

        try { presInput.setSelectionRange(pos - (raw.length - clean.length), pos - (raw.length - clean.length)); } catch {  }
      }
      handlePresentInput(room, presInput.value);
      markDirty(room, true);

      updateFieldError(card, room, presInput.value);
    });
    updateCardMath(card, room);
    }
  }
}

function groupBySide(rooms: Room[]): { label: string | null; rooms: Room[] }[] {
  if (!rooms.some(r => r.side)) return [{ label: null, rooms }];
  const a = rooms.filter(r => r.side === 'A');
  const b = rooms.filter(r => r.side === 'B');
  const groups: { label: string | null; rooms: Room[] }[] = [];
  if (a.length) groups.push({ label: 'BUILDING A', rooms: a });
  if (b.length) groups.push({ label: 'BUILDING B', rooms: b });
  return groups;
}

function handlePresentInput(room: Room, value: string): void {
  const stateNow = state.get();
  const existing = stateNow.bills[cardKey(room.id, stateNow.month)];

  const prev = existing?.prevReading ?? null;
  const pres = value === '' ? null : parseFloat(value);
  const { consumption, subtotal, total } = computeBill(prev, pres, stateNow.rate, stateNow.surcharge);

  const nextBill: Bill = {
    roomId: room.id,
    roomNumber: room.number,
    floor: room.floor,
    month: stateNow.month,
    rate: stateNow.rate,
    prevReading: prev,
    presReading: pres,
    consumption,
    subtotal,
    surcharge: stateNow.surcharge,
    total,
    status: existing?.status ?? 'unpaid',
    paidDate: existing?.paidDate ?? null
  };

  state.set({ bills: { ...stateNow.bills, [cardKey(room.id, stateNow.month)]: nextBill } });

  const card = document.querySelector(`.room-card[data-room="${room.id}"]`);
  if (card) updateCardMath(card as HTMLElement, room);
}

function updateFieldError(card: HTMLElement, room: Room, value: string): void {
  const marker = card.querySelector('[data-field-err]') as HTMLElement | null;
  if (value === '') {
    marker?.classList.remove('on');
    return;
  }
  const prev = billFor(room)?.prevReading ?? null;
  const pres = parseFloat(value);
  const hasError = prev != null && pres < prev;

  if (!marker) {

    const wrap = card.querySelector('.pres-wrap');
    if (!wrap) return;
    const el = document.createElement('span');
    el.className = 'field-err';
    el.setAttribute('data-field-err', '');
    el.setAttribute('aria-label', 'Reading below previous — consumption floored at 0');
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    wrap.appendChild(el);
  }
  const el = card.querySelector('[data-field-err]') as HTMLElement;
  el.classList.toggle('on', hasError);
}

function updateCardMath(card: HTMLElement, room: Room): void {
  const bill = billFor(room);
  const rate = state.get().rate;
  const surcharge = state.get().surcharge;
  const consumption = bill?.consumption ?? 0;
  const subtotal = bill?.subtotal ?? 0;
  const total = bill?.total ?? 0;

  const breakEl = card.querySelector('[data-math-break]') as HTMLElement;
  const totalEl = card.querySelector('[data-math-total]') as HTMLElement;

  breakEl.innerHTML = `
    <span class="math-chunk">
      <span class="math-num">${consumption.toFixed(1)} m³</span>
      <span class="math-op">×</span>
      <span class="math-rate">₱${rate.toFixed(2)}/m³</span>
      <span class="math-op">=</span>
      <span class="math-num">${money(subtotal)}</span>
    </span>
    <span class="math-chunk math-chunk-surcharge">
      <span class="math-op">+</span>
      <span class="math-surcharge">${money(surcharge)}</span>
      <span class="math-unit">E-motor</span>
    </span>`;

  totalEl.textContent = bill?.presReading != null ? money(total) : money(surcharge);

  const saveDot = card.querySelector('[data-save]') as HTMLElement;
  saveDot.classList.toggle('dirty', dirty.has(cardKey(room.id, state.get().month)));
}

export function markDirty(room: Room, isDirty: boolean): void {
  const key = cardKey(room.id, state.get().month);
  if (isDirty) dirty.add(key); else dirty.delete(key);
  const card = document.querySelector(`.room-card[data-room="${room.id}"]`);
  if (card) {
    const dot = (card as HTMLElement).querySelector('[data-save]') as HTMLElement;
    dot?.classList.toggle('dirty', isDirty);
  }
  emitUnsaved();
}

export function isDirty(room: Room): boolean {
  return dirty.has(cardKey(room.id, state.get().month));
}

export function refreshMath(): void {
  const { rooms } = state.get();
  document.querySelectorAll('.room-card').forEach(card => {
    const roomId = Number((card as HTMLElement).dataset.room);
    const room = rooms.find(r => r.id === roomId);
    if (room) updateCardMath(card as HTMLElement, room);
  });
}

export function applyRate(rate: number): void {
  const st = state.get();
  const next: Record<string, Bill> = { ...st.bills };
  let changed = false;
  for (const key of Object.keys(next)) {
    const b = next[key];
    if (b.month !== st.month || b.presReading == null) continue;
    const { consumption, subtotal, total } = computeBill(b.prevReading, b.presReading, rate, st.surcharge);
    next[key] = { ...b, rate, consumption, subtotal, total };
    changed = true;
  }

  state.set(changed ? { bills: next, rate } : { rate });
  refreshMath();
  emitUnsaved();
}
