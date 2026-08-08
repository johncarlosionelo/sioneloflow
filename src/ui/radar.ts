
import { state } from '../state';
import { cardKey } from './cards';
import { setFloor } from './floors';
import { orderRooms } from '../engine';
import { DROP_ICON, DROP_VIEWBOX } from '../logo';

let radarEl: HTMLElement | null = null;
let lastKey = '';

export function mountRadar(): void {
  if (radarEl) return;
  const el = document.createElement('div');
  el.className = 'radar';
  el.id = 'uf-radar';
  el.innerHTML = `
    <div class="radar-pill" id="radar-pill" role="button" tabindex="0" aria-expanded="false" aria-label="Unfilled rooms">
      <span class="radar-drop" aria-hidden="true">
        <svg viewBox="${DROP_VIEWBOX}" fill="currentColor" stroke="none"><path d="${DROP_ICON}"/></svg>
      </span>
      <span class="radar-copy">
        <span class="radar-label" id="radar-label">—</span>
        <span class="radar-sub" id="radar-sub">Tap to jump</span>
      </span>
      <span class="radar-chev" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
      </span>
    </div>
    <div class="radar-panel" id="radar-panel">
      <div class="radar-panel-head">
        <span class="radar-panel-title">FILL THESE ROOMS</span>
        <span class="radar-panel-hint">Tap a room to jump straight to it</span>
      </div>
      <div class="radar-chips" id="radar-chips"></div>
      <div class="radar-foot" id="radar-foot"></div>
    </div>
  `;
  document.body.appendChild(el);
  radarEl = el;

  const pill = el.querySelector('#radar-pill') as HTMLElement;
  const toggle = (open?: boolean) => {
    const next = open ?? !el.classList.contains('open');
    el.classList.toggle('open', next);
    pill.setAttribute('aria-expanded', String(next));
  };
  pill.addEventListener('click', () => toggle());
  pill.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    if (e.key === 'Escape') toggle(false);
  });

  el.addEventListener('click', e => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('.radar-chip');
    if (!chip) return;
    const id = Number(chip.dataset.room);
    toggle(false);
    void teleportToRoom(id);
  });

  state.subscribe(refresh);
  refresh();
}

function refresh(): void {
  if (!radarEl) return;
  const st = state.get();
  const month = st.month;
  if (!month || st.rooms.length === 0) {
    radarEl.classList.remove('show');
    return;
  }
  const unfilled = orderRooms(st.rooms.filter(r => {
    const b = st.bills[cardKey(r.id, month)];
    return !b || b.presReading == null;
  }));
  const key = unfilled.map(r => r.id).join(',');
  radarEl.classList.toggle('show', unfilled.length > 0);
  if (key === lastKey) return;
  lastKey = key;

  window.dispatchEvent(new Event('resize'));

  const label = radarEl.querySelector('#radar-label');
  const sub = radarEl.querySelector('#radar-sub');
  const chips = radarEl.querySelector('#radar-chips');
  const foot = radarEl.querySelector('#radar-foot');
  const total = st.rooms.length;
  const filled = total - unfilled.length;

  if (label) label.textContent = unfilled.length === 1
    ? `ROOM ${unfilled[0].number} UNFILLED`
    : `${unfilled.length} ROOMS UNFILLED`;
  if (sub) sub.textContent = filled > 0 ? `${filled}/${total} read · tap to jump` : 'Nothing read yet · tap to jump';
  if (chips) chips.innerHTML = unfilled.map(r =>
    `<button type="button" class="radar-chip" data-room="${r.id}" title="Room ${r.number}">${r.number}</button>`
  ).join('');
  if (foot) foot.textContent = 'Every room read = every slip prints';
}

export async function teleportToRoom(roomId: number): Promise<void> {
  const st = state.get();
  const room = st.rooms.find(r => r.id === roomId);
  if (!room) return;

  if (st.floor !== room.floor) {
    setFloor(room.floor, false, true);

    if (document.querySelector('.full-loader')) return;
  }

  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const card = document.querySelector<HTMLElement>(`.room-card[data-room="${roomId}"]`);
  if (!card) return;
  glideToCard(card);
}

function topBarClearance(): number {
  const header = document.querySelector<HTMLElement>('.app-header');
  const flag = document.getElementById('unsaved-wrap');
  const flagH = flag && flag.classList.contains('show') ? flag.offsetHeight : 0;
  return (header?.offsetHeight ?? 64) + flagH + 14;
}

function glideToCard(card: HTMLElement): void {
  const offset = topBarClearance();
  const targetY = Math.max(0, card.getBoundingClientRect().top + window.scrollY - offset);
  const startY = window.scrollY;
  const dist = targetY - startY;
  if (Math.abs(dist) < 2) {
    landSettled(card);
    return;
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const dur = reduce ? 0 : Math.min(650, 380 + Math.abs(dist) * 0.25);
  if (dur === 0) {
    window.scrollTo(0, targetY);
    landSettled(card);
    return;
  }
  const t0 = performance.now();
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / dur);
    window.scrollTo(0, startY + dist * ease(p));
    if (p < 1) requestAnimationFrame(step);
    else landSettled(card);
  };
  requestAnimationFrame(step);
}

let lastCaretRoom: number | null = null;

export function noteFocusedRoom(roomId: number | null): void {
  lastCaretRoom = roomId;
}

export function lastFocusedPresentRoom(): number | null {
  return lastCaretRoom;
}

function landSettled(card: HTMLElement): void {
  land(card);
  if (window.innerWidth >= 900) return;
  const targetTop = topBarClearance();

  requestAnimationFrame(() => requestAnimationFrame(() => {
    const delta = card.getBoundingClientRect().top - targetTop;
    if (Math.abs(delta) > 1) {
      window.scrollTo(0, Math.max(0, window.scrollY + delta));
    }
  }));
}

function land(card: HTMLElement): void {
  card.classList.add('radar-flash');
  const roomId = Number(card.dataset.room);
  if (!Number.isNaN(roomId)) noteFocusedRoom(roomId);
  const input = card.querySelector<HTMLInputElement>('[data-pres]');
  if (!input) return;
  input.focus();

  try {
    const end = input.value.length;
    input.setSelectionRange(end, end);
  } catch {  }

  if (card.dataset.radarLanded) return;
  card.dataset.radarLanded = '1';
  const clear = () => {
    card.classList.remove('radar-flash');
    delete card.dataset.radarLanded;
  };
  input.addEventListener('blur', clear, { once: true });
  input.addEventListener('input', clear, { once: true });
}
