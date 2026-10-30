// HTML from template literals: html`<td>${text}</td>` escapes every value, so
// text from a run file can't become markup. A value that is itself html`…`,
// or an array of them, is inserted as it is.
class Html {
  constructor(text) {
    this.text = text;
  }
  toString() {
    return this.text;
  }
}

export function html(strings, ...values) {
  let text = strings[0];
  values.forEach((value, i) => {
    text += insert(value) + strings[i + 1];
  });
  return new Html(text);
}

function insert(value) {
  if (value instanceof Html) return value.text;
  if (Array.isArray(value)) return value.map(insert).join('');
  if (value === null || value === undefined || value === false) return '';
  return escape(String(value));
}

export function escape(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
