import ast from '../template/ast'
import Element from './element'
import { isComponent } from './utils'

export default function createVDOM (template) {
  const astTree = ast(template) // 这颗树充当整个应用，应当被记录下来
  // 将这棵树的节点与对应的组件节点相关联，在调用setState后进行更新
  console.log(astTree)
  return toVirtualElment(astTree)
}

function toVirtualElment (node) {
  const create = function (currentNode) {
    const children = currentNode.children
    const elementChildren = children.map(child => {
      return create(child)
    })
    if (currentNode.value) {
      elementChildren.push(currentNode.value)
    }
    if (isComponent(currentNode.type)) {
      const $instance = currentNode.$instance
      $instance._astNode = currentNode
      return elementChildren[0]
    } else {
      const element = new Element(currentNode.type, currentNode.props, elementChildren)
      return element
    }
  }
  return create(node)
}
