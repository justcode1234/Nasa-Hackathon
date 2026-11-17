export function el(tag, text, attributes = {}) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
}
export const number = (value, digits = 1) => value == null ? 'Missing' : Number(value).toFixed(digits);
export function list(items) {
  const ul = el('ul');
  items.forEach(item => ul.append(el('li', item)));
  return ul;
}
export function sourceLinks(ids, sources) {
  const p = el('p', 'Sources: ');
  ids.forEach((id, i) => {
    const source = sources.find(s => s.id === id);
    if (!source) return;
    if (i) p.append(' · ');
    // Only an absolute http(s) URL becomes a link; anything else stays readable as text
    // so a source label can never turn into a javascript: or data: target.
    p.append(/^https?:\/\/\S+$/i.test(source.url ?? '')
      ? el('a', source.title, { href: source.url, target: '_blank', rel: 'noreferrer' })
      : el('span', source.title));
  });
  return p;
}
export function table(headers, rows, caption) {
  const wrapper = el('div', null, { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': caption });
  const node = el('table');
  node.append(el('caption', caption));
  const head = el('thead');
  const row = el('tr');
  headers.forEach(header => row.append(el('th', header, { scope: 'col' })));
  head.append(row);
  const body = el('tbody');
  rows.forEach(values => {
    const tr = el('tr');
    values.forEach((value, index) => tr.append(el(index === 0 ? 'th' : 'td', value, index === 0 ? { scope: 'row' } : {})));
    body.append(tr);
  });
  node.append(head, body);
  wrapper.append(node);
  return wrapper;
}
