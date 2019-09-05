/* eslint-disable no-unmodified-loop-condition */
import { TAG_CLOSE, TAG_OPEN, TAG_VALUE, TAG_ATTR_NAME, TAG_ATTR_VALUE } from './tagType.js'
import { arrToMap } from './utils.js'
import { isComponent } from '../vdom/utils'
import ast from './ast'

export default class Syntax {
  nextToken () {
    const { tokens } = this
    this.lookAhead = tokens[++this.currentIndex]
  }

  match (type) {
    if (this.lookAhead && this.lookAhead.type === type) {
      this.nextToken()
    } else {
      throw SyntaxError('语法错误')
    }
  }

  start () {
    const node = { type: 'root', value: null, children: [] }
    this.tags(node)
    return node
  }

  tags (currentNode) {
    while (this.lookAhead) { // 在TAG_CLOSE后，处理多个token
      const value = this.lookAhead.value
      const Component = this.components[value] // 用于判断是组件，还是普通元素
      let node = {
        type: Component || value,
        value: null,
        props: {},
        children: []
      }
      node = this.tag(node)
      // 当前节点解析完成后判断它是否为组件
      if (isComponent(node.type)) {
        node.props.children = node.value
        const children = ast(new Component(node.props).render())
        node.children.push(children)
      }

      currentNode.children.push(node)
      if (this.lookAhead && this.lookAhead.type === TAG_CLOSE) {
        break
      }
    }
    return currentNode
  }

  tag (currentNode) {
    this.match(TAG_OPEN)
    if (this.lookAhead && this.lookAhead.type === TAG_ATTR_NAME) { // 处理props
      currentNode = this.attrs(currentNode)
    }
    if (this.lookAhead && this.lookAhead.type === TAG_OPEN) { // ahead 为开始，则其为当前的子tag
      currentNode = this.tags(currentNode)
    } else if (this.lookAhead && this.lookAhead.type === TAG_VALUE) { // ahead 为 value
      currentNode.value = this.lookAhead.value
      this.match(TAG_VALUE) // 进入token
    }
    this.match(TAG_CLOSE) // ahead 为 结束
    return currentNode
  }

  attrs (currentNode) {
    const props = []
    while (this.lookAhead) {
      props.push(this.lookAhead.value)
      this.match(this.lookAhead.type)
      if (!this.lookAhead || (this.lookAhead.type !== TAG_ATTR_NAME && this.lookAhead.type !== TAG_ATTR_VALUE)) {
        currentNode.props = arrToMap(props)
        break
      }
    }
    return currentNode
  }

  parse (ts, cs) {
    this.tokens = ts
    this.components = cs
    this.currentIndex = 0
    this.lookAhead = this.tokens[this.currentIndex]
    const ast = this.start()
    return ast.children[0]
  }
}
