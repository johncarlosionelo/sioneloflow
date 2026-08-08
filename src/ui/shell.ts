
import type { Building } from '../db';
import { state } from '../state';
import { MONTHS, monthKey, monthLabel, computeBill, orderRooms } from '../engine';
import { api } from '../db';
import { cardKey, renderCards, applyRate, deckLoading, deckReady, deckError, isDeckOwner, markClean, onUnsavedChange } from './cards';
import { renderFloorNav, setFloor, scrollToTop, FLOOR_ICONS } from './floors';
import { openSlipsDialog } from './print';
import { openPrintDialog } from './dbprint';
import { mountRadar, teleportToRoom, noteFocusedRoom, lastFocusedPresentRoom } from './radar';
import { toast } from './toast';
import { confirmDiscard } from './guard';
import { errorMessage, errorDetail } from '../errors';
import { customSelect } from './select';
import { DROP_ICON, DROP_VIEWBOX } from '../logo';

const THEME_KEY = 'sioneloflow.theme';

const SHELL_HTML = `
  <div class="app">
    <header class="app-header">
      <div class="header-inner">
        <div class="brand">
          <div class="brand-mark">
            <svg viewBox="${DROP_VIEWBOX}" fill="currentColor" stroke="none"><path d="${DROP_ICON}"/></svg>
          </div>
          <div>
            <div class="brand-name">Sionelo<em>Flow</em></div>
            <span class="brand-sub">Water Bill</span>
          </div>
        </div>
        <div class="header-cluster">
          <div class="build-switch" id="build-switch"></div>
          <div class="control period">
            <span class="control-label">Period</span>
            <div class="period-picker">
              <div class="select-wrap"><select id="month-select" aria-label="Month"></select></div>
              <div class="select-wrap"><select id="year-select" aria-label="Year"></select></div>
            </div>
          </div>
          <div class="control rate">
            <span class="control-label">Rate ₱/m³</span>
            <input type="number" id="rate-input" step="0.01" min="0" aria-label="Rate per cubic meter" />
          </div>
        </div>
        <div class="header-actions">
          <button class="header-icon-btn dbprint" id="dbprint-btn-h" title="Print Database" aria-label="Print Database">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </button>
          <button class="theme-toggle" id="theme-toggle" aria-label="Toggle light/dark theme"></button>
        </div>

        </div>
      <div class="switch-bar" id="switch-bar"></div>
    </header>

    <div class="unsaved-wrap" id="unsaved-wrap" aria-live="polite">
      <div class="unsaved-inner">

        <div class="unsaved-bar" id="unsaved-bar" role="button" tabindex="0" aria-label="Save all changes">
          <span class="unsaved-count" id="unsaved-count">0</span>
          <span class="unsaved-label" id="unsaved-label">unsaved readings</span>
          <span class="unsaved-rule"></span>
          <button type="button" class="unsaved-revert" id="unsaved-revert" title="Discard all unsaved changes" aria-label="Discard all unsaved changes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          </button>
          <span class="unsaved-save">Save
            <svg class="unsaved-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
          </span>
        </div>
      </div>
    </div>

    <div class="layout">
      <aside class="sidebar">
        <div class="side-nav" id="side-nav"></div>
        <div class="side-actions">
          <button class="dock-btn print" id="print-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            Print Slits
          </button>
        </div>

        <div class="side-mode" id="side-mode"></div>
      </aside>

      <main class="card-deck" id="card-deck"></main>
    </div>

    <div class="bottom-dock">

      <button type="button" class="dock-next" id="dock-next" title="Jump to the next present-reading field" aria-label="Next present field">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/><path d="M6 15l6 6 6-6"/></svg>
        <span>Next present</span>
      </button>
      <div class="floor-dock" id="floor-dock"></div>
    </div>

    <footer class="app-foot" id="app-foot"></footer>
  </div>
`;

function yearRange(): number[] {
  const y = new Date().getFullYear();
  const years: number[] = [];
  for (let i = y - 4; i <= y + 10; i++) years.push(i);
  return years;
}

function readPeriod(): string {
  const m = (document.getElementById('month-select') as HTMLSelectElement).value;
  const y = (document.getElementById('year-select') as HTMLSelectElement).value;
  return `${y}-${m}`;
}

function revertPeriodToCurrent(): void {
  const [curY, curM] = state.get().month.split('-');
  for (const [id, val] of [['month-select', curM], ['year-select', curY]] as const) {
    const sel = document.getElementById(id) as HTMLSelectElement | null;
    if (!sel) continue;
    sel.value = val;
    const label = sel.parentElement?.querySelector('.custom-select .sel-label') as HTMLElement | null;
    if (label) label.textContent = sel.selectedOptions[0]?.textContent ?? '';
  }
}

export function renderShell(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = SHELL_HTML;
  app.querySelector('.app')?.classList.add('on');

  const st = state.get();
  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  const [curY, curM] = (st.month || monthKey(prev)).split('-');

  const monthSelect = document.getElementById('month-select') as HTMLSelectElement;
  monthSelect.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const opt = document.createElement('option');
    opt.value = String(i + 1).padStart(2, '0');
    opt.textContent = MONTHS[i];
    monthSelect.appendChild(opt);
  }
  monthSelect.value = curM;

  const yearSelect = document.getElementById('year-select') as HTMLSelectElement;
  yearSelect.innerHTML = '';
  for (const y of yearRange()) {
    const opt = document.createElement('option');
    opt.value = String(y);
    opt.textContent = String(y);
    yearSelect.appendChild(opt);
  }
  yearSelect.value = curY;

  customSelect(monthSelect);
  customSelect(yearSelect);

  const rateInput = document.getElementById('rate-input') as HTMLInputElement;
  rateInput.value = String(st.rate);
}

export function bindShell(): void {

  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
  themeToggle.addEventListener('click', () => toggleTheme());

  const onPeriodChange = () => {
    const next = readPeriod();
    if (next === state.get().month) return;
    confirmDiscard('You have unsaved changes. If you switch periods, they will be lost.', async () => {

      await deckLoading(`Loading ${monthLabel(next)}…`);
      document.getElementById('unsaved-wrap')?.classList.remove('show');
      state.set({ month: next });
      void reload().then(ok => { if (ok) scrollToTop(); });
    }, revertPeriodToCurrent);
  };
  document.getElementById('month-select')?.addEventListener('change', onPeriodChange);
  document.getElementById('year-select')?.addEventListener('change', onPeriodChange);

  document.getElementById('rate-input')?.addEventListener('input', e => {
    const rate = parseFloat((e.target as HTMLInputElement).value);
    if (!isNaN(rate)) {
      applyRate(rate);
    }
  });

  document.getElementById('print-btn')?.addEventListener('click', () => openSlipsDialog());
  document.getElementById('dbprint-btn-h')?.addEventListener('click', () => openPrintDialog());

  const unsavedBar = document.getElementById('unsaved-bar');
  unsavedBar?.addEventListener('click', () => commit());
  unsavedBar?.addEventListener('keydown', e => {

    if (e.target !== unsavedBar) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void commit();
    }
  });

  document.getElementById('unsaved-revert')?.addEventListener('click', e => {
    e.stopPropagation();
    void discardUnsaved();
  });
  onUnsavedChange(updateUnsavedBar);

  syncTopBar();
  const headerEl = document.querySelector<HTMLElement>('.app-header');
  if (headerEl && 'ResizeObserver' in window) {
    new ResizeObserver(syncTopBar).observe(headerEl);
  }
  window.addEventListener('resize', syncTopBar);

  const vv = 'visualViewport' in window ? window.visualViewport : null;

  const kbLiftState = new WeakMap<HTMLElement, number>();
  let rePin = false;
  const kbLift = () => {
    const top = document.querySelector<HTMLElement>('.app-header');
    const wrap = document.getElementById('unsaved-wrap');
    const radar = document.getElementById('uf-radar');
    const dockNext = document.getElementById('dock-next');
    if (!vv || window.innerWidth >= 900 || !top) {

      document.body.classList.remove('kb-up');
      return;
    }
    const kb = window.innerHeight - vv.height;

    document.body.classList.toggle('kb-up', kb > 60);
    if (kb <= 60) {

      for (const el of [top, wrap, radar, dockNext]) {
        if (el && kbLiftState.has(el)) {
          el.style.transform = '';
          el.style.transition = '';
          kbLiftState.delete(el);
        }
      }
      if (dockNext) { dockNext.style.alignSelf = ''; dockNext.style.marginRight = ''; }
      return;
    }

    const write = (el: HTMLElement, t: number) => {

      el.style.transition = 'none';
      el.style.transform = `translateY(${t}px)`;
      kbLiftState.set(el, t);

      if (!rePin) {
        rePin = true;
        requestAnimationFrame(() => { rePin = false; kbLift(); });
      }
    };
    const pinTop = (el: HTMLElement | null, target = 0) => {
      if (!el || el.getClientRects().length === 0) return;
      const last = kbLiftState.get(el) ?? 0;
      const t = target - (el.getBoundingClientRect().top - last);
      if (Math.abs(t - last) < 0.5) return;
      write(el, t);
    };

    const pinBottom = (el: HTMLElement | null, target: number) => {
      if (!el || el.getClientRects().length === 0) return;
      const last = kbLiftState.get(el) ?? 0;
      const t = target - (el.getBoundingClientRect().bottom - last);
      if (Math.abs(t - last) < 0.5) return;
      write(el, t);
    };
    pinTop(top);

    pinTop(wrap, top.getBoundingClientRect().bottom);

    pinBottom(radar, vv.height - 14);

    pinBottom(dockNext, vv.height - 14);

    const radarShown = !!radar && radar.classList.contains('show');
    if (dockNext) {
      dockNext.style.alignSelf = radarShown ? 'flex-end' : '';
      dockNext.style.marginRight = radarShown ? '10px' : '';
    }
  };
  if (vv) {
    vv.addEventListener('resize', kbLift);
    vv.addEventListener('scroll', kbLift);
    window.addEventListener('resize', kbLift);
  }

  const deckEl = document.getElementById('card-deck');
  deckEl?.addEventListener('focusin', e => {
    const t = (e.target as HTMLElement | null)?.closest?.('[data-pres]') as HTMLInputElement | null;
    if (t?.dataset.room) noteFocusedRoom(Number(t.dataset.room));
  });
  document.getElementById('dock-next')?.addEventListener('click', () => {
    const st = state.get();
    const ordered = orderRooms(st.rooms);
    if (ordered.length === 0) return;
    const active = document.activeElement as HTMLElement | null;
    const curCard = active?.closest?.('.room-card') as HTMLElement | null;
    const curId = curCard ? Number(curCard.dataset.room) : lastFocusedPresentRoom();
    const curIdx = curId != null && !Number.isNaN(curId)
      ? ordered.findIndex(r => r.id === curId)
      : -1;
    const next = ordered[(curIdx + 1) % ordered.length] ?? ordered[0];
    void teleportToRoom(next.id);
  });

  const sideNav = document.getElementById('side-nav') as HTMLElement;
  const floorDock = document.getElementById('floor-dock') as HTMLElement;
  if (sideNav) renderSideNav(sideNav);
  if (floorDock) renderFloorNav(floorDock);
  applyTheme();
  updateMode();

  window.addEventListener('scroll', onScrollThrottled, { passive: true });
  updateBottomLabel();

  mountRadar();
}

function renderSideNav(container: HTMLElement): void {
  container.innerHTML = '';
  const { floor, buildingName } = state.get();
  const isEmpress = buildingName === 'Empress';
  const effective = isEmpress ? ['1st', '2nd', '3rd', '4th', '5th'] : ['Ground', '2nd', '3rd', 'Gate', '—'];
  for (let f = 1; f <= 5; f++) {
    if (buildingName === 'Ramos' && f === 5) continue;
    const btn = document.createElement('button');
    btn.className = 'side-tab' + (floor === f ? ' active' : '');
    btn.dataset.floor = String(f);
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${FLOOR_ICONS[f]}</svg><span>${effective[f - 1]}</span>`;
    btn.addEventListener('click', () => setFloor(f));
    container.appendChild(btn);
  }
}

export async function renderBuildSwitch(): Promise<void> {
  const wrap = document.getElementById('build-switch');
  if (!wrap) return;
  const buildings = await api.getBuildings();
  wrap.innerHTML = '';
  for (const b of buildings) {
    const btn = document.createElement('button');
    btn.textContent = b.name;
    btn.dataset.building = String(b.id);
    btn.addEventListener('click', () => switchBuilding(b));
    wrap.appendChild(btn);
  }
  const thumb = document.createElement('span');
  thumb.className = 'build-thumb';
  wrap.appendChild(thumb);
  wrap.classList.add('has-thumb');

  const st = state.get();
  const target = buildings.find(b => b.id === st.buildingId) ?? buildings[0];
  if (target && target.id !== st.buildingId) {
    state.set({ buildingId: target.id, buildingName: target.name });
  }
  markSwitchActive(wrap);

  syncSwitchPlacement(wrap);
  const mq = window.matchMedia('(max-width: 510px)');
  mq.onchange = () => syncSwitchPlacement(wrap);

  wrap.addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('button')) return;
    const other = [...wrap.querySelectorAll<HTMLButtonElement>('button')]
      .find(b => b.dataset.building !== String(state.get().buildingId));
    if (other) other.click();
  });
}

function syncSwitchPlacement(wrap: HTMLElement): void {
  const small = window.matchMedia('(max-width: 510px)').matches;
  const thumb = wrap.querySelector<HTMLElement>('.build-thumb');
  if (thumb) {
    thumb.classList.toggle('small-thumb', small);
    thumb.classList.toggle('wide-thumb', !small);
  }
  const bar = document.getElementById('switch-bar');
  const cluster = document.querySelector<HTMLElement>('.header-cluster');
  if (!bar || !cluster) return;
  const target = small ? bar : cluster;
  if (wrap.parentElement !== target) target.appendChild(wrap);
}

function positionThumb(wrap: HTMLElement): void {
  const btns = wrap.querySelectorAll<HTMLButtonElement>('button');
  const active = [...btns].find(b => b.dataset.building === String(state.get().buildingId));
  if (!active) return;

  wrap.dataset.active = btns[0] === active ? '0' : '1';
}

function markSwitchActive(wrap: HTMLElement): void {
  wrap.querySelectorAll<HTMLButtonElement>('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.building === String(state.get().buildingId));
  });
  positionThumb(wrap);
}

async function switchBuilding(building: Building): Promise<void> {
  if (state.get().buildingId === building.id) return;

  confirmDiscard(`You have unsaved changes. If you switch to ${building.name}, they will be lost.`, () => {
    void doSwitchBuilding(building);
  });
}

async function doSwitchBuilding(building: Building): Promise<void> {

  await deckLoading(`Loading ${building.name}…`);
  document.getElementById('unsaved-wrap')?.classList.remove('show');

  state.set({ buildingId: building.id, buildingName: building.name });

  state.set({ floor: 1 });
  const wrap = document.getElementById('build-switch');
  if (wrap) markSwitchActive(wrap);
  const ok = await reload();
  if (ok) scrollToTop();
}

function hasFieldErrors(): boolean {
  return document.querySelector('.field-err.on') !== null;
}

let flagWasShown = false;

const MOBILE_TOP_GAP = 14;

function syncTopBar(): void {
  const headerEl = document.querySelector<HTMLElement>('.app-header');
  const layoutEl = document.querySelector<HTMLElement>('.layout');
  const wrap = document.getElementById('unsaved-wrap');
  const h = headerEl ? headerEl.offsetHeight : 0;
  if (wrap) wrap.style.top = `${h}px`;
  if (layoutEl && window.innerWidth < 900) {
    const flagH = wrap && wrap.classList.contains('show') ? wrap.offsetHeight : 0;
    layoutEl.style.paddingTop = `${h + flagH + MOBILE_TOP_GAP}px`;
  } else if (layoutEl) {
    layoutEl.style.paddingTop = '';
  }
}

function updateUnsavedBar(count: number): void {
  const wrap = document.getElementById('unsaved-wrap');
  if (!wrap) return;
  const num = document.getElementById('unsaved-count');
  const label = document.getElementById('unsaved-label');
  if (num) num.textContent = String(count);
  if (label) label.textContent = count === 1 ? 'unsaved reading' : 'unsaved readings';

  const bar = document.getElementById('unsaved-bar');
  bar?.classList.remove('guard');
  const shown = count > 0;
  wrap.classList.toggle('show', shown);
  syncTopBar();

  if (shown && !flagWasShown) {
    if (bar) {
      bar.classList.remove('bar-bounce');
      void bar.offsetWidth;
      bar.classList.add('bar-bounce');
    }
    const deck = document.getElementById('card-deck');
    if (deck) {
      deck.classList.remove('deck-bounce');
      void deck.offsetWidth;
      deck.classList.add('deck-bounce');
    }
  } else if (!shown) {
    bar?.classList.remove('bar-bounce');
    document.getElementById('card-deck')?.classList.remove('deck-bounce');
  }
  flagWasShown = shown;
}

function applyTheme(): void {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
  document.documentElement.dataset.theme = theme;
  syncThemeIcon();
}

function toggleTheme(): void {
  const current = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  const apply = () => {
    document.documentElement.dataset.theme = current;
    localStorage.setItem(THEME_KEY, current);
    syncThemeIcon();

    const btn = document.getElementById('theme-toggle') as HTMLButtonElement;
    if (btn) {
      btn.classList.remove('pop');
      void btn.offsetWidth;
      btn.classList.add('pop');
    }
  };

  const btn = document.getElementById('theme-toggle') as HTMLButtonElement | null;
  if (btn) {
    const r = btn.getBoundingClientRect();
    document.documentElement.style.setProperty('--wipe-x', `${Math.round(r.left + r.width / 2)}px`);
    document.documentElement.style.setProperty('--wipe-y', `${Math.round(r.top + r.height / 2)}px`);
  }
  const canWipe = 'startViewTransition' in document
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canWipe) {

    try {
      (document as Document & { startViewTransition(cb: () => void): void }).startViewTransition(apply);
    } catch {
      apply();
    }
  } else {
    apply();
  }
}

function syncThemeIcon(): void {
  const btn = document.getElementById('theme-toggle') as HTMLButtonElement;
  if (!btn) return;
  const light = document.documentElement.dataset.theme !== 'light';
  btn.innerHTML = light
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`;
}

export async function reload(): Promise<boolean> {

  const deck = document.getElementById('card-deck');
  const st0 = state.get();
  const msg = st0.month
    ? `Loading ${monthLabel(st0.month)}${st0.buildingName ? ` · ${st0.buildingName}` : ''}…`
    : 'Gathering data…';
  const loadToken = await deckLoading(msg);

  const st = state.get();
  let settings, rooms, bills;
  let rate = st.rate;
  try {
    [settings, rooms, bills] = await Promise.all([
      api.getSettings(),
      api.getRooms(st.buildingId),
      api.getBills(st.month)
    ]);

    const roomIds = new Set(rooms.map(r => r.id));
    const buildingBills = bills.filter(b => roomIds.has(b.roomId));

    const withRate =
      buildingBills.find(b => b.rate > 0 && b.presReading != null) ??
      buildingBills.find(b => b.rate > 0) ??
      buildingBills[0];
    rate = withRate ? withRate.rate : settings.rate;

    const billMap: Record<string, import('../engine').Bill> = {};
    for (const b of buildingBills) billMap[cardKey(b.roomId, st.month)] = b;

    const prevBills = await api.getPreviousBills(rooms.map(r => r.id), st.month);
    const prevByRoom = new Map<number, import('../engine').Bill>();
    for (const pb of prevBills) if (!prevByRoom.has(pb.roomId)) prevByRoom.set(pb.roomId, pb);

    for (const room of rooms) {
      const key = cardKey(room.id, st.month);
      const existing = billMap[key];
      const pb = prevByRoom.get(room.id);

      const prevReading = pb ? pb.presReading : (existing?.prevReading ?? null);
      if (existing) {

        const billRate = existing.rate ?? rate;
        const sur = existing.surcharge ?? st.surcharge;
        if (existing.presReading != null) {
          const r = computeBill(prevReading, existing.presReading, billRate, sur);
          billMap[key] = { ...existing, prevReading, consumption: r.consumption, subtotal: r.subtotal, total: r.total };
        } else {
          billMap[key] = { ...existing, prevReading };
        }
      } else {
        billMap[key] = {
          roomId: room.id,
          roomNumber: room.number,
          floor: room.floor,
          month: st.month,
          rate: pb?.rate || rate,
          prevReading,
          presReading: null,
          consumption: 0,
          subtotal: 0,
          surcharge: st.surcharge,
          total: 0,
          status: 'unpaid',
          paidDate: null
        };
      }
    }

    state.set({
      rate,
      surcharge: settings.surcharge,
      rooms,
      bills: billMap
    });
  } catch (err) {

    const msg = errorMessage(err);
    console.error(err);
    void api.reportError({
      action: 'load',
      building: st.buildingName,
      month: st.month,
      rate: st.rate,
      message: msg,
      detail: errorDetail(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    deckError(loadToken, msg, () => void reload());
    return false;
  }

  const rateInput = document.getElementById('rate-input') as HTMLInputElement;
  if (rateInput) rateInput.value = String(rate);

  const hasFloor = rooms.some(r => r.floor === st.floor);
  if (!hasFloor) state.set({ floor: 1 });

  if (!isDeckOwner(loadToken)) return false;

  try {
    renderCards(deck as HTMLElement);
    const dock = document.getElementById('floor-dock') as HTMLElement;
    const sideNav = document.getElementById('side-nav') as HTMLElement;
    if (dock) renderFloorNav(dock);
    if (sideNav) renderSideNav(sideNav);
  } catch (err) {

    const msg = errorMessage(err);
    console.error(err);
    void api.reportError({
      action: 'render',
      building: st.buildingName,
      month: st.month,
      rate: st.rate,
      message: msg,
      detail: errorDetail(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    deckError(loadToken, msg, () => void reload());
    return false;
  }
  if (!(await deckReady(loadToken))) return false;
  markClean();
  updateMode();
  updateBottomLabel();
  return true;
}

async function discardUnsaved(): Promise<void> {
  await deckLoading('Discarding changes…');
  document.getElementById('unsaved-wrap')?.classList.remove('show');
  await reload();
}

async function commit(): Promise<void> {
  const st = state.get();

  if (hasFieldErrors()) {
    const bar = document.getElementById('unsaved-bar');
    const num = document.getElementById('unsaved-count');
    const label = document.getElementById('unsaved-label');
    if (num) num.textContent = '!';
    if (label) label.textContent = 'Fix invalid reading first';
    bar?.classList.add('guard');
    bar?.classList.remove('guard-pulse');
    void bar?.offsetWidth;
    bar?.classList.add('guard-pulse');

    return;
  }

  const pending = Object.values(st.bills)
    .filter(b => b.month === st.month)
    .map(b => {
      const { consumption, subtotal, total } = computeBill(b.prevReading, b.presReading, st.rate, st.surcharge);
      return { ...b, rate: st.rate, consumption, subtotal, total };
    });
  if (pending.length === 0) {
    toast('Nothing to save yet — enter readings first', 'warn');
    return;
  }
  const readRooms = pending.filter(b => b.presReading != null).length;

  const isNewMonth = pending.every(b => b.id == null);

  const saveToken = await deckLoading('Saving readings…');

  document.getElementById('unsaved-wrap')?.classList.remove('show');
  try {
    await api.upsertBills(pending);
    if (isNewMonth) {

      try {
        await api.saveSettings(st.rate, st.surcharge);
      } catch (se) {
        console.error('[saveSettings]', se);
        void api.reportError({
          action: 'save_settings',
          building: st.buildingName,
          month: st.month,
          rate: st.rate,
          message: 'settings write failed',
          stack: se instanceof Error ? se.stack : undefined
        });
      }
    }
    void api.logEvent({
      event: 'save',
      building: st.buildingName,
      month: st.month,
      rate: st.rate,
      surcharge: st.surcharge,
      rooms: readRooms,
      total: pending.reduce((s, b) => s + b.total, 0)
    });

    await reload();
    toast(readRooms > 0
      ? `Saved ${readRooms} readings · rate ₱${st.rate.toFixed(2)} for ${monthLabel(st.month)}`
      : `Rate ₱${st.rate.toFixed(2)} saved for ${monthLabel(st.month)}`, 'ok');
  } catch (err) {
    const msg = errorMessage(err);
    console.error(err);
    void api.reportError({
      action: 'save',
      building: st.buildingName,
      month: st.month,
      rate: st.rate,
      message: msg,
      detail: [`rooms=${pending.length}`, errorDetail(err)].filter(Boolean).join(' | ') || undefined,
      stack: err instanceof Error ? err.stack : undefined
    });

    deckError(saveToken, msg, () => { void commit(); }, "Couldn't save:");
    toast(`Save failed — ${msg}`, 'err');
  }
}

function updateMode(): void {
  void api.usingSupabase().then(cloud => {

    const label = !import.meta.env.DEV && cloud ? 'Cloud (Supabase)' : 'Local Mode';
    const foot = document.getElementById('app-foot');
    if (foot) foot.textContent = label;
    const side = document.getElementById('side-mode');
    if (side) side.textContent = label;
  });
}

let bottomRaf = 0;

function updateBottomLabel(): void {
  const foot = document.getElementById('app-foot');
  if (!foot) return;
  const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 16;
  foot.classList.toggle('show', atBottom);
}

function onScrollThrottled(): void {
  if (bottomRaf) return;
  bottomRaf = requestAnimationFrame(() => {
    bottomRaf = 0;
    updateBottomLabel();
  });
}
