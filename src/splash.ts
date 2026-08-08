
export function playSplash(): Promise<void> {
  return new Promise(resolve => {
    const splash = document.getElementById('splash');
    if (!splash) return resolve();
    splash.classList.add('on');
    setTimeout(() => {
      splash.classList.add('out');
      setTimeout(() => {
        splash.remove();
        resolve();
      }, 700);
    }, 1150);
  });
}
