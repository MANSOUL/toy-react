import { TAG_CLOSE, TAG_OPEN, TAG_VALUE, TAG_ATTR_NAME, TAG_ATTR_VALUE, TAG_SINGLE } from './tagType.js'
import { temlateValue } from './utils.js'

const REG_TAG_SINGLE = /^<([\w]+)\s*([^>]*)\s*\/>/ // 自闭合标签
const REG_TAG_OPEN = /^<([\w]+)\s*([^>]*)\s*>/
const REG_TAG_CLOSE = /^<\/([\w]+)\s*>/
const REG_TAG_VALUE = /[^<]+/
const REG_TAG_ATTR = /([\w-]+)=("?[^"]+"?)/g

function trim (str) {
  return str.replace(/^\n+\s+|\s+$/g, '')
}

function parseToken (str) {
  if (str.match(REG_TAG_SINGLE)) {
    const matches = str.match(REG_TAG_SINGLE)
    return {
      type: TAG_SINGLE,
      value: matches[1],
      index: matches.index,
      length: matches[0].length,
      attrs: matches[2]
    }
  } else if (str.match(REG_TAG_OPEN)) {
    const matches = str.match(REG_TAG_OPEN)
    return {
      type: TAG_OPEN,
      value: matches[1],
      index: matches.index,
      length: matches[0].length,
      attrs: matches[2]
    }
  } else if (str.match(REG_TAG_CLOSE)) {
    const matches = str.match(REG_TAG_CLOSE)
    return {
      type: TAG_CLOSE,
      value: matches[1],
      index: matches.index,
      length: matches[0].length
    }
  } else if (str.match(REG_TAG_VALUE)) {
    const matches = str.match(REG_TAG_VALUE)
    return {
      type: TAG_VALUE,
      value: matches[0],
      index: matches.index,
      length: matches[0].length
    }
  }
  throw SyntaxError('词法错误')
}

function parseAttr (attr) {
  let m = null
  const attrs = []
  // eslint-disable-next-line no-cond-assign
  while (m = REG_TAG_ATTR.exec(attr)) {
    attrs.push({
      type: TAG_ATTR_NAME,
      value: m[1]
    })
    attrs.push({
      type: TAG_ATTR_VALUE,
      value: temlateValue(m[2])
    })
  }
  return attrs
}

export default function parse (templateObj) {
  let template = templateObj.html
  let tokens = []
  let start = 0
  while (template.length > 0) {
    template = trim(template)
    const token = parseToken(template)
    if (token.type === TAG_SINGLE) { // 自闭合标签
      tokens.push({
        type: TAG_OPEN,
        value: token.value
      })
      tokens.push({
        type: TAG_CLOSE,
        value: token.value
      })
    } else {
      const t = {
        type: token.type,
        value: token.value
      }
      tokens.push(t)
    }
    if (token.attrs) { // 继续解析属性
      tokens = tokens.concat(parseAttr(token.attrs))
    }
    start = token.index + token.length
    template = template.substr(start)
  }
  return tokens
}
