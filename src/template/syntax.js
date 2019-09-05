/* eslint-disable no-unmodified-loop-condition */
import { TAG_CLOSE, TAG_OPEN, TAG_VALUE, TAG_ATTR_NAME, TAG_ATTR_VALUE } from './tagType.js'
import { arrToMap } from './utils.js'
import { isComponent } from '../vdom/utils'
import ast from './ast'

let currentIndex, lookAhead, tokens, components

const nextToken = () => {
  lookAhead = tokens[++currentIndex]
}

const match = type => {
  if (lookAhead && lookAhead.type === type) {
    nextToken()
  } else {
    throw SyntaxError('语法错误')
  }
}

const LL = {
  start () {
    const node = { type: 'root', value: null, children: [] }
    LL.tags(node)
    return node
  },
  tags (currentNode) {
    while (lookAhead) { // 在TAG_CLOSE后，处理多个token
      const value = lookAhead.value
      const Component = components[value] // 用于判断是组件，还是普通元素
      let node = {
        type: Component || value,
        value: null,
        props: {},
        children: []
      }
      node = LL.tag(node)
      // 当前节点解析完成后判断它是否为组件
      if (isComponent(node.type)) {
        const children = ast(new Component(node.props).render())
        node.children.push(children)
      }

      currentNode.children.push(node)
      if (lookAhead && lookAhead.type === TAG_CLOSE) {
        break
      }
    }
    return currentNode
  },
  tag (currentNode) {
    match(TAG_OPEN)
    if (lookAhead && lookAhead.type === TAG_ATTR_NAME) { // 处理props
      currentNode = LL.attrs(currentNode)
    }
    if (lookAhead && lookAhead.type === TAG_OPEN) { // ahead 为开始，则其为当前的子tag
      currentNode = LL.tags(currentNode)
    } else if (lookAhead && lookAhead.type === TAG_VALUE) { // ahead 为 value
      currentNode.value = lookAhead.value
      match(TAG_VALUE) // 进入token
    }
    match(TAG_CLOSE) // ahead 为 结束
    return currentNode
  },
  attrs (currentNode) {
    const props = []
    while (lookAhead) {
      props.push(lookAhead.value)
      match(lookAhead.type)
      if (!lookAhead || (lookAhead.type !== TAG_ATTR_NAME && lookAhead.type !== TAG_ATTR_VALUE)) {
        currentNode.props = arrToMap(props)
        break
      }
    }
    return currentNode
  }
}

export default function generateAST (ts, cs) {
  tokens = ts
  components = cs
  currentIndex = 0
  lookAhead = tokens[currentIndex]
  const ast = LL.start()
  return ast.children[0]
}
