import { trim } from '../utils'
import createElement from '../createElement'

const regTagStart = /^<(\w+)\s*([^>]*)\s*>/
const regTagClose = /^<\/(\w+)\s*>/
const regTagValue = /^[^<]*/
const TAG_START = 'TAG_START'
const TAG_CLOSE = 'TAG_CLOSE'
const TAG_VALUE = 'TAG_VALUE'

const parseToken = template => {
  let type = ''
  let matches = null
  let value = null

  if ((matches = template.match(regTagStart))) {
    type = TAG_START
    value = matches[1]
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
    subIndex: matches.index + matches[0].length
  }
}

const parseLexical = template => {
  const tokens = []
  let temp = trim(template)
  while (temp.length) {
    temp = trim(temp)
    const token = parseToken(temp)
    temp = temp.substring(token.subIndex)
    tokens.push(token)
  }
  return tokens
}

const parseSyntax = tokens => {
  let index = 0
  let nextToken = tokens[index]
  let current = null

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
        parent: current
      }
      current.children.push(tempRoot)
      current = tempRoot
    } else if (nextToken.type === TAG_CLOSE) {
      const tempRoot = current
      current = tempRoot.parent
      delete tempRoot.parent
    } else if (nextToken.type === TAG_VALUE) {
      current.children.push(nextToken.value)
    }

    nextToken = goNext()
  }

  return tree.children[0]
}

const convertToElements = tree => {
  const children = tree.children ? tree.children.map(convertToElements) : []
  return typeof tree === 'object' ? createElement(tree.type, null, ...children) : tree
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
