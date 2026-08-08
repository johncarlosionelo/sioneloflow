
export type ToastTone = 'ok' | 'warn' | 'err';

const TOAST_MS = 3200;

const ICONS: Record<ToastTone, string> = {
  ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  err: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
};

export function toast(message: string, tone: ToastTone = 'ok'): void {
  let el = document.getElementById('toast') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }

  const header = document.querySelector<HTMLElement>('.app-header');
  let top = (header ? header.offsetHeight : 0) + 14;
  const flag = document.getElementById('unsaved-wrap');
  if (flag?.classList.contains('show')) top += flag.offsetHeight + 8;
  el.style.top = `${top}px`;

  el.className = `toast toast-${tone}`;
  el.setAttribute('role', tone === 'err' ? 'alert' : 'status');
  el.innerHTML =
    `<span class="toast-icon">${ICONS[tone]}</span>` +
    `<span class="toast-msg"></span>` +
    `<span class="toast-bar"></span>`;
  (el.querySelector('.toast-msg') as HTMLElement).textContent = message;

  el.classList.remove('show');
  void el.offsetWidth;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout((el as any)._t);
  (el as any)._t = setTimeout(() => el.classList.remove('show'), TOAST_MS);
}
