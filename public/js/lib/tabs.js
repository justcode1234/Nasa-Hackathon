export function setNavigationLabel(button,label) {
  const text=String(label),leading=text.startsWith('← '),trailing=text.endsWith(' →');
  if(!leading&&!trailing){button.textContent=text;return;}
  const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent=leading?'←':'→';
  button.replaceChildren(...(leading?[arrow,` ${text.slice(2)}`]:[`${text.slice(0,-2)} `,arrow]));
}
export function initTabs() {
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const main = document.querySelector('main');
  const back = document.querySelector('#flow-back'), next = document.querySelector('#flow-next');
  let activeIndex = 0;
  function activate(id, focus = false) {
    if (!tabs.some(t => t.getAttribute('aria-controls') === id)) id = 'location';
    activeIndex = tabs.findIndex(t => t.getAttribute('aria-controls') === id);
    tabs.forEach(tab => {
      const selected = tab.getAttribute('aria-controls') === id;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
      if (selected && focus) tab.focus();
    });
    history.replaceState(null, '', `#${id}`);
    main.scrollTop = 0;
    if (window.matchMedia('(max-height: 560px)').matches) window.scrollTo(0, 0);
    back.disabled = activeIndex === 0;
    next.hidden = activeIndex === tabs.length - 1;
    const label = index => tabs[index].textContent.replace(/^\d+\s*·\s*/, '');
    setNavigationLabel(next,activeIndex < tabs.length - 1 ? `Next: ${label(activeIndex + 1)} →` : 'Next');
    setNavigationLabel(back,activeIndex > 0 ? `← Back: ${label(activeIndex - 1)}` : 'Back');
    document.querySelector('#flow-progress').textContent = `Step ${activeIndex + 1} of ${tabs.length} · ${label(activeIndex)}`;
    window.dispatchEvent(new Event('fieldshift:tabchange'));
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activate(tab.getAttribute('aria-controls')));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowRight') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') target = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target !== undefined) { event.preventDefault(); activate(tabs[target].getAttribute('aria-controls'), true); }
    });
  });
  back.addEventListener('click', () => activate(tabs[activeIndex - 1]?.getAttribute('aria-controls'), true));
  next.addEventListener('click', () => {
    const from = tabs[activeIndex].getAttribute('aria-controls');
    const to = tabs[activeIndex + 1]?.getAttribute('aria-controls');
    if (activate.beforeNext?.(from, to) !== false) activate(to, true);
  });
  window.addEventListener('hashchange', () => activate(location.hash.slice(1)));
  activate(location.hash.slice(1));
  return activate;
}
