import ast from '../template/ast'
import Element from './element'
import { isComponent } from './utils'

export default function createVDOM (template) {
  const astTree = ast(template) // 这颗树充当整个应用，应当被记录下来
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
      return elementChildren[0]
    } else {
      const element = new Element(currentNode.type, currentNode.props, elementChildren)
      return element
    }
  }
  return create(node)
}