
export function customSelect(select: HTMLSelectElement): void {
  const wrap = select.parentElement;
  if (!wrap || wrap.querySelector('.custom-select')) return;

  select.classList.add('native-hidden');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'custom-select';
  btn.setAttribute('aria-haspopup', 'listbox');
  btn.innerHTML = '<span class="sel-label"></span><span class="chev"></span>';

  const menu = document.createElement('div');
  menu.className = 'select-menu';

  const label = btn.querySelector('.sel-label') as HTMLElement;

  function setLabel(): void {
    label.textContent = select.selectedOptions[0]?.textContent ?? '';
  }

  function render(): void {
    setLabel();
    menu.innerHTML = '';
    for (const opt of select.options) {
      const item = document.createElement('button');
      item.type = 'button';
      item.setAttribute('role', 'option');
      item.textContent = opt.textContent;
      item.classList.toggle('selected', opt.selected);
      item.addEventListener('click', () => {
        select.value = opt.value;
        setLabel();
        select.dispatchEvent(new Event('change', { bubbles: true }));
        close();
      });
      menu.appendChild(item);
    }
  }

  function scrollport(): { top: number; bottom: number } {
    let node: HTMLElement | null = wrap!;
    while (node && node !== document.body) {
      const cs = getComputedStyle(node);

      if (/(auto|scroll|overlay|hidden)/.test(cs.overflowY)) {
        const r = node.getBoundingClientRect();
        return { top: r.top, bottom: r.bottom };
      }
      node = node.parentElement;
    }
    return { top: 0, bottom: window.innerHeight };
  }

  function open(): void {
    render();
    const vp = scrollport();
    const r = wrap!.getBoundingClientRect();

    const below = vp.bottom - r.bottom - 20;
    const above = r.top - vp.top - 20;
    if (below < 180) {
      menu.classList.add('up');
      menu.style.maxHeight = `${Math.max(110, Math.min(250, above))}px`;
    } else {
      menu.classList.remove('up');
      menu.style.maxHeight = `${Math.max(110, Math.min(250, below))}px`;
    }
    menu.classList.add('open');
    btn.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
  }

  function close(): void {
    menu.classList.remove('open');
    btn.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    menu.style.maxHeight = '';
  }

  btn.addEventListener('click', e => {
    e.preventDefault();
    if (menu.classList.contains('open')) close();
    else open();
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target as Node)) close();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      e.stopImmediatePropagation();
      close();
    }
  });

  wrap.appendChild(btn);
  wrap.appendChild(menu);
  render();
}
