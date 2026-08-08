
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource-variable/manrope';
import './style.css';
import { monthKey } from './engine';
import { state } from './state';
import { isAuthed } from './ui/gate';
import { renderGate } from './ui/gate';
import { playSplash } from './splash';
import { bindShell, reload, renderShell, renderBuildSwitch } from './ui/shell';
import { deckLoading, deckError } from './ui/cards';
import { armLeaveGuard } from './ui/guard';
import { errorMessage, errorDetail } from './errors';
import { api } from './db';

let booted = false;

window.addEventListener('error', ev => {
  void api.reportError({
    action: 'window',

    message: ev.message || 'Uncaught error',
    detail: [ev.filename ? `${ev.filename}:${ev.lineno}:${ev.colno}` : undefined, errorDetail(ev.error)].filter(Boolean).join(' | ') || undefined,
    stack: ev.error instanceof Error ? ev.error.stack : undefined,
    url: location.href
  });
});

window.addEventListener('unhandledrejection', ev => {
  const reason = ev.reason;
  void api.reportError({
    action: 'unhandledrejection',
    message: errorMessage(reason),
    detail: errorDetail(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    url: location.href
  });
});

async function bootApp(): Promise<void> {
  if (booted) return;
  booted = true;
  renderShell();
  bindShell();

  armLeaveGuard();

  const bootToken = await deckLoading('Loading SioneloFlow…');

  try {
    const m = new Date();
    m.setMonth(m.getMonth() - 1);
    state.set({ month: monthKey(m) });
    await renderBuildSwitch();
    await reload();
  } catch (err) {

    const msg = errorMessage(err);
    console.error(err);
    void api.reportError({
      action: 'boot',
      message: msg,
      detail: errorDetail(err),
      stack: err instanceof Error ? err.stack : undefined,
      url: location.href
    });
    deckError(bootToken, msg, () => window.location.reload());
  }
}

async function start(): Promise<void> {
  await playSplash();
  if (isAuthed()) {
    await bootApp();
  } else {
    renderGate();
    const unsub = state.subscribe(() => {
      if (state.get().authed) {
        unsub();
        void bootApp();
      }
    });
  }
}

void start();
