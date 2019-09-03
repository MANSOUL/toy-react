import parse from './lexical.js';
import generate from './syntax.js';
import { tValue } from './utils.js';

export function t (statics, ...values) {
  let html = '';
  statics.map((s, i) => {
    html += s + tValue(values[i]);
  });
  return html;
}

export function ast (template) {
  return generate(parse(template)).children[0];
}