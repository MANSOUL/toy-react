import { trim } from '../utils'
import createElement from '../createElement'

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
  console.log(tokens)
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
      const tempRoot = {
        type: nextToken.value,
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
      current.props[attrName] = nextToken.value
    } else if (nextToken.type === TAG_VALUE) {
      current.children.push(nextToken.value)
    }

    nextToken = goNext()
  }

  return tree.children[0]
}

const convertToElements = tree => {
  const children = tree.children ? tree.children.map(convertToElements) : []
  return typeof tree === 'object' ? createElement(tree.type, tree.props, ...children) : tree
}

export const t = template => convertToElements(parseSyntax(parseLexical(template)))

// const template = `
//   <div id="div1">
//     <p>
//       hehe
//       <span>this</span>
//       <span>is</span>
//       <span>p1</span>
//     </p>
//     <p>this is p2</p>
//   </div>
// `

// console.log(parseLexical(template))
// console.log(JSON.stringify(parseSyntax(parseLexical(template))))
// console.log(JSON.stringify(convertToElements(parseSyntax(parseLexical(template)))))
