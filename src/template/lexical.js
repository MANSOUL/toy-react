import { TAG_CLOSE, TAG_OPEN, TAG_VALUE, TAG_ATTR_NAME, TAG_ATTR_VALUE } from './tagType.js';
import { temlateValue } from './utils.js';

const REG_TAG_OPEN = /^<([\w]+)\s*([^>]*)\s*>/;
const REG_TAG_CLOSE = /^<\/([\w]+)\s*>/;
const REG_TAG_VALUE = /[^<]+/;
const REG_TAG_ATTR = /([\w-]+)=("?[^\s]+"?)/g;

function trim(str) {
  return str.replace(/^\s+|\s+$/g, '');
}

function parseToken (str) {
  if (str.match(REG_TAG_OPEN)) {
    let matches = str.match(REG_TAG_OPEN);
    return {
      type: TAG_OPEN,
      value: matches[1],
      index: matches.index,
      length: matches[0].length,
      attrs: matches[2]
    };
  } else if (str.match(REG_TAG_CLOSE)) {
     let matches = str.match(REG_TAG_CLOSE);
     return {
       type: TAG_CLOSE,
       value: matches[1],
       index: matches.index,
       length: matches[0].length
     };
   } else if (str.match(REG_TAG_VALUE)) {
    let matches = str.match(REG_TAG_VALUE);
    return {
      type: TAG_VALUE,
      value: matches[0],
      index: matches.index,
      length: matches[0].length
    };
  }
  throw SyntaxError('语法错误');
}

function parseAttr (attr) {
  let m = null;
  let attrs = [];
  while(m = REG_TAG_ATTR.exec(attr)) {
    attrs.push({
      type: TAG_ATTR_NAME,
      value: m[1]
    });
    attrs.push({
      type: TAG_ATTR_VALUE,
      value: temlateValue(m[2])
    });
  }
  return attrs;
}

export default function parse (template) { 
  let tokens = [];
  let start = 0;

  while (template.length > 0) {
    template = trim(template);
    let token = parseToken(template);
    let t = {
      type: token.type, 
      value: token.value
    };
    start = token.index + token.length;
    tokens.push(t);
    if (token.attrs) {
      tokens = tokens.concat(parseAttr(token.attrs));
    }
    template = template.substr(start);
  }
  return tokens;
}