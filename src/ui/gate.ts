
import { state } from '../state';
import { DROP_ICON, DROP_VIEWBOX } from '../logo';
import { api } from '../db';

const SUPABASE_ADMIN_EMAIL = 'admin@sioneloflow.app';

let sessionAuthed = false;

export function isAuthed(): boolean {
  return sessionAuthed;
}

function markAuthed(): void {
  sessionAuthed = true;
  state.set({ authed: true });
}

export function lockout(): void {
  sessionAuthed = false;
  state.set({ authed: false });
  api.lockout();
}

export async function tryUnlock(key: string): Promise<{ ok: boolean; message?: string }> {
  const res = await api.unlock(SUPABASE_ADMIN_EMAIL, key);
  if (res.ok) {
    void api.logEvent({ event: 'login', msg: 'unlock success' });
    markAuthed();
  } else {
    void api.logEvent({ event: 'login_failed', msg: 'bad master key' });
  }
  return res;
}

const gateHtml = `
  <div class="gate" id="gate">
    <div class="gate-orb gate-orb-a"></div>
    <div class="gate-orb gate-orb-b"></div>
    <div class="gate-card">
      <div class="gate-mark">
        <svg viewBox="${DROP_VIEWBOX}" fill="currentColor" stroke="none"><path d="${DROP_ICON}"/></svg>
      </div>
      <h1 class="gate-title">Sionelo<span>Flow</span></h1>
      <p class="gate-greet">Welcome back, Engineer Sionelo!</p>
      <p class="gate-hint">Enter your master key to unlock access and prevent unauthorized metrics modifications.</p>
      <div class="gate-divider"><span></span></div>
      <div class="gate-field">
        <input type="password" id="gate-key" autocomplete="current-password" placeholder="Master key" spellcheck="false" />
      </div>
      <button class="gate-btn" id="gate-btn">Unlock System</button>
      <div class="gate-error" id="gate-error">Access denied. Try again.</div>
    </div>
  </div>
`;

export function renderGate(): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.innerHTML = gateHtml;

  const keyInput = document.getElementById('gate-key') as HTMLInputElement;
  const btn = document.getElementById('gate-btn') as HTMLButtonElement;
  const err = document.getElementById('gate-error') as HTMLDivElement;

  async function attempt() {
    btn.disabled = true;
    const res = await tryUnlock(keyInput.value);
    if (res.ok) {
      keyInput.value = '';
    } else {
      btn.disabled = false;
      err.textContent = res.message ?? 'Access denied. Try again.';
      err.classList.add('show');
      keyInput.classList.add('shake');
      keyInput.value = '';
      keyInput.focus();
      setTimeout(() => {
        err.classList.remove('show');
        keyInput.classList.remove('shake');
      }, 2200);
    }
  }

  btn.addEventListener('click', attempt);
  keyInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') attempt();
  });
  keyInput.focus();
}
