
import { hasUnsaved, markClean } from './cards';

const GUARD_STATE = '__sioneloflow_guard__';

const LEAVE_WINDOW_MS = 2000;

const REARM_INTERVAL_MS = 400;

let armed = false;
let allowLeaveUntil = 0;
let modalEl: HTMLElement | null = null;
let lastFocused: HTMLElement | null = null;
let modalOnLeave: (() => void) | null = null;
let modalOnCancel: (() => void) | null = null;

let sentinelSeq = 0;
let rearmTimer: number | null = null;

function inLeaveWindow(): boolean {
  return Date.now() < allowLeaveUntil;
}

function isSentinelState(st: unknown): boolean {
  return !!st && typeof st === 'object' && (st as { [k: string]: unknown })[GUARD_STATE] === true;
}

function pushSentinel(): void {
  window.history.pushState({ [GUARD_STATE]: true, t: ++sentinelSeq }, '');
}

function rearmIfNeeded(): void {
  if (!armed || inLeaveWindow()) return;
  if (isSentinelState(window.history.state)) return;
  try {
    pushSentinel();
  } catch {

  }
}

function startRearmLoop(): void {
  if (rearmTimer !== null) return;
  rearmTimer = window.setInterval(rearmIfNeeded, REARM_INTERVAL_MS);
}

function stopRearmLoop(): void {
  if (rearmTimer !== null) {
    window.clearInterval(rearmTimer);
    rearmTimer = null;
  }
}

function onBeforeUnload(e: BeforeUnloadEvent): void {
  if (inLeaveWindow()) return;
  e.preventDefault();
  e.returnValue = '';
}

function onPopState(): void {
  if (inLeaveWindow()) return;

  pushSentinel();

  if (modalEl) return;

  if (hasUnsaved()) {
    showModal(
      'Unsaved changes',
      'You have unsaved changes. If you leave now, they will be lost.',
      confirmLeave
    );
  } else {
    showModal(
      'Leave the app?',
      'Are you sure you want to leave? Everything is saved, and you can come back anytime.',
      confirmLeave
    );
  }
}

function onPageHide(e: PageTransitionEvent): void {
  if (e.persisted) forceCleanModal();
}

function onPageShow(e: PageTransitionEvent): void {
  if (e.persisted) {
    forceCleanModal();
    allowLeaveUntil = 0;
  }
}

export function armLeaveGuard(): void {
  if (armed) return;
  armed = true;
  allowLeaveUntil = 0;
  window.addEventListener('beforeunload', onBeforeUnload);

  const st = window.history.state;
  if (!isSentinelState(st)) {
    pushSentinel();
  }
  window.addEventListener('popstate', onPopState);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  window.addEventListener('pointerdown', rearmIfNeeded);
  window.addEventListener('touchstart', rearmIfNeeded);
  startRearmLoop();
}

export function disarmLeaveGuard(): void {
  if (!armed) return;
  armed = false;
  stopRearmLoop();
  window.removeEventListener('beforeunload', onBeforeUnload);
  window.removeEventListener('popstate', onPopState);
  window.removeEventListener('pagehide', onPageHide);
  window.removeEventListener('pageshow', onPageShow);
  window.removeEventListener('pointerdown', rearmIfNeeded);
  window.removeEventListener('touchstart', rearmIfNeeded);
  hideModal(false);
}

function lockScroll(on: boolean): void {
  document.documentElement.classList.toggle('loading-lock', on);
  document.body.classList.toggle('loading-lock', on);
}

function forceCleanModal(): void {
  let removed = false;
  if (modalEl) {
    modalEl.remove();
    modalEl = null;
    removed = true;
  } else {
    const stale = document.querySelector('.leave-guard');
    if (stale) {
      stale.remove();
      removed = true;
    }
  }
  modalOnLeave = null;
  modalOnCancel = null;

  if (removed && !document.querySelector('.full-loader')) {
    lockScroll(false);
  }
}

function showModal(title: string, message: string, onLeave: () => void, onCancel?: () => void): void {

  forceCleanModal();
  modalOnLeave = onLeave;
  modalOnCancel = onCancel ?? null;
  lastFocused = document.activeElement as HTMLElement | null;

  const wrap = document.createElement('div');
  wrap.className = 'leave-guard';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.setAttribute('aria-labelledby', 'leave-guard-title');
  wrap.innerHTML = `
    <div class="leave-card">
      <div class="leave-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <h2 class="leave-title" id="leave-guard-title">${title}</h2>
      <p class="leave-msg">${message}</p>
      <div class="leave-actions">
        <button class="leave-btn leave-stay" type="button">Stay</button>
        <button class="leave-btn leave-go" type="button">Leave anyway</button>
      </div>
    </div>
  `;

  const stay = wrap.querySelector('.leave-stay') as HTMLButtonElement;
  const go = wrap.querySelector('.leave-go') as HTMLButtonElement;
  stay.addEventListener('click', () => stayModal());
  go.addEventListener('click', () => {
    const cb = modalOnLeave;
    modalOnLeave = null;
    if (cb) cb();
  });

  wrap.addEventListener('keydown', e => {
    if (e.key === 'Escape') stayModal();
  });

  document.body.appendChild(wrap);
  modalEl = wrap;
  lockScroll(true);
  stay.focus();
}

function hideModal(runCancel: boolean): void {
  if (!modalEl) return;
  const el = modalEl;
  modalEl = null;
  const onCancel = modalOnCancel;
  modalOnCancel = null;
  modalOnLeave = null;
  lockScroll(false);
  el.classList.add('out');

  window.setTimeout(() => {
    if (el.isConnected) el.remove();
  }, 240);
  if (lastFocused && lastFocused.isConnected) lastFocused.focus();

  if (runCancel && onCancel) onCancel();
}

function stayModal(): void {
  hideModal(true);

  rearmIfNeeded();
}

function confirmLeave(): void {

  allowLeaveUntil = Date.now() + LEAVE_WINDOW_MS;
  hideModal(false);

  try {
    if (window.history.length > 2) {
      window.history.go(-2);
    } else {
      window.history.back();
    }
  } catch {

  }
}

export function confirmDiscard(message: string, action: () => void, onCancel?: () => void): void {
  if (!hasUnsaved()) {
    action();
    return;
  }
  showModal('Unsaved changes', message, () => {
    markClean();
    hideModal(false);
    action();
  }, onCancel);
}
