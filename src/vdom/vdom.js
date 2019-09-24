import Element from './element'
import { isComponent } from './utils'

export default function vdom (node) {
  const create = function (currentNode) {
    const children = currentNode.children
    const elementChildren = children.map(child => {
      return create(child)
    })
    if (currentNode.value) {
      elementChildren.push(currentNode.value)
    }
    if (isComponent(currentNode.type)) {
      // 在此处为组件重新设置一个render函数，将解析过后的Element在这个函数中定义，
      // 那么在下一次重新渲染时就不需要在重新解析模版了
      currentNode.$instance.$vdom = elementChildren[0]
      return elementChildren[0]
    } else {
      const element = new Element(currentNode.type, currentNode.props, elementChildren)
      return element
    }
  }
  return create(node)
}
