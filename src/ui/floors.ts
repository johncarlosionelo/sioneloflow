
import { state } from '../state';
import { renderCards, deckSwapping } from './cards';

export function floorLabels(buildingName: string): string[] {
  if (buildingName === 'Empress') return ['1st', '2nd', '3rd', '4th', '5th'];
  return ['Ground', '2nd', '3rd', 'Gate'];
}

export const FLOOR_ICONS: Record<number, string> = {
  1: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  2: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="12" x2="21" y2="12"/>',
  3: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>',
  4: '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>',
  5: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>'
};

export function renderFloorNav(container: HTMLElement): void {
  const { floor, buildingName } = state.get();
  const labels = floorLabels(buildingName);
  container.innerHTML = '';

  for (let f = 1; f <= 5; f++) {
    if (buildingName === 'Ramos' && f === 5) continue;
    const btn = document.createElement('button');
    btn.className = 'floor-tab' + (floor === f ? ' active' : '');
    btn.dataset.floor = String(f);
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${FLOOR_ICONS[f]}</svg>
      <span>${labels[f - 1]}</span>
    `;
    btn.addEventListener('click', () => setFloor(f));
    container.appendChild(btn);
  }
}

export function scrollToTop(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  }));
}

export function setFloor(floor: number, scrollTop = true, quiet = false): void {
  if (state.get().floor === floor) return;
  state.set({ floor });
  const deck = document.getElementById('card-deck');
  const swapping = deckSwapping();

  if (deck && !swapping) renderCards(deck as HTMLElement, quiet);

  if (!swapping && scrollTop) scrollToTop();
  document.querySelectorAll('.floor-tab, .side-tab').forEach(el => {
    el.classList.toggle('active', Number((el as HTMLElement).dataset.floor) === floor);
  });
}
