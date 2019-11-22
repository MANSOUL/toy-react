const trim = s => {
  return s.replace(/^[\s\n]+|\s+$/g, '')
}

const regTagStart = /^<(\w+)\s*([^>]*)\s*>/
const regTagClose = /^<\/(\w+)\s*>/
const regTagValue = /^[^<]*/
const regTagAttr = /([\w-]+)="([^"]+)"/g
const TAG_START = 'TAG_START'
const TAG_CLOSE = 'TAG_CLOSE'
const TAG_VALUE = 'TAG_VALUE'
const TAG_ATTR_NAME = 'TAG_ATTR_NAME'
const TAG_ATTR_VALUE = 'TAG_ATTR_VALUE'

const parseToken = template => {
  let type = ''
  let matches = null
  let value = null
  let attrs = ''

  if ((matches = template.match(regTagStart))) {
    type = TAG_START
    value = matches[1]
    attrs = matches[2]
  } else if ((matches = template.match(regTagClose))) {
    type = TAG_CLOSE
    value = matches[1]
  } else if ((matches = template.match(regTagValue))) {
    type = TAG_VALUE
    value = matches[0]
  } else {
    throw new TypeError('lexical error')
  }

  return {
    type,
    value,
    subIndex: matches.index + matches[0].length,
    attrs
  }
}

function parseAttr (attr) {
  let m = null
  const attrs = []

  while ((m = regTagAttr.exec(attr))) {
    attrs.push({
      type: TAG_ATTR_NAME,
      value: m[1]
    })
    attrs.push({
      type: TAG_ATTR_VALUE,
      value: m[2]
    })
  }
  return attrs
}

const parseLexical = template => {
  let tokens = []
  let temp = trim(template)
  while (temp.length) {
    temp = trim(temp)
    const token = parseToken(temp)
    temp = temp.substring(token.subIndex)
    tokens.push(token)
    if (token.type === TAG_START) {
      tokens = tokens.concat(parseAttr(token.attrs))
    }
  }
  return tokens
}

const parseSyntax = tokens => {
  let index = 0
  let nextToken = tokens[index]
  let current = null
  let attrName = ''

  const tree = current = {
    type: 'root',
    children: []
  }

  const goNext = () => {
    return tokens[++index]
  }

  while (nextToken) {
    if (nextToken.type === TAG_START) {
      let value = nextToken.value
      if (isObjectValue(value)) {
        value = getObjectValue(globalObjects, value)
      }
      const tempRoot = {
        type: value,
        children: [],
        props: {},
        parent: current
      }
      current.children.push(tempRoot)
      current = tempRoot
    } else if (nextToken.type === TAG_CLOSE) {
      const tempRoot = current
      current = tempRoot.parent
      delete tempRoot.parent
    } else if (nextToken.type === TAG_ATTR_NAME) {
      attrName = nextToken.value
    } else if (nextToken.type === TAG_ATTR_VALUE) {
      let value = nextToken.value
      if (isObjectValue(value)) {
        value = getObjectValue(globalObjects, value)
      }
      current.props[attrName] = value
    } else if (nextToken.type === TAG_VALUE) {
      let value = nextToken.value
      if (isObjectValue(value)) {
        value = getObjectValue(globalObjects, value)
      }
      current.children.push(value)
    }

    nextToken = goNext()
  }

  return tree.children[0]
}

const type = o => Object.prototype.toString.call(o).slice(8, -1).toLowerCase()
const isPrimitive = o => ['number', 'string', 'boolean'].indexOf(type(o)) !== -1
const isNullOrUndefined = o => ['null', 'undefined'].indexOf(type(o)) !== -1
const isExistIn = (objects, value) => {
  const keys = Object.keys(objects)
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    if (objects[k] === value) {
      return k
    }
  }
  return null
}
const isObjectValue = key => /PresetObject\d+/.test(key)
const getObjectValue = (objects, key) => {
  const regExp = /PresetObject\d+/
  return objects[regExp.exec(key)[0]]
}
let globalObjects = null
const preset = (statics, ...entities) => {
  const objects = {}
  let template = ''
  let count = 0
  let i = 0
  for (; i < entities.length; i++) {
    let e = entities[i]
    if (isNullOrUndefined(e)) {
      e = ''
    }

    if (!isPrimitive(e)) {
      const existkey = isExistIn(objects, e)
      if (existkey) {
        e = existkey
      } else {
        const key = `PresetObject${count++}`
        objects[key] = e
        e = key
      }
    }
    template += (statics[i] + e)
  }
  template += statics[i]
  globalObjects = objects
  console.log(objects)
  return template
}

function App () {

}

const name = 'heihei'
const template = preset`
  <${App} onClick="${() => {}}">
    <p>${
      [1, 2, 3].map(item => `<span>hello item ${item}</span>`)
    }</p>
    ${
      [1, 2, 3].map(item => `<p>hello item ${item}</p>`)
    }
    <p>${name}</p>
    <p>${null}</p>
    <p>${undefined}</p>
  </${App}>
`

console.log(parseLexical(template))
console.log(parseSyntax(parseLexical(template)))
console.log(JSON.stringify(parseSyntax(parseLexical(template))))
