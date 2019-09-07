import { isComponent } from '../vdom/utils'

const REG_EVENT = /^on/

export function setProps ($el, props) {
  for (const k in props) {
    if (Object.prototype.hasOwnProperty.call(props, k)) {
      if (k.match(REG_EVENT)) {
        $el.addEventListener(k.replace(REG_EVENT, '').toLowerCase(), props[k])
      } else {
        $el.setAttribute(k, props[k])
      }
    }
  }
}

export function appendChildren ($el, children) {
  const $fragment = document.createDocumentFragment()
  children.map(node => {
    $fragment.appendChild(createNode(node))
  })
  return $el.appendChild($fragment)
}

export function setTextContent ($el, content) {
  $el.textContent = content
}

export function createElment (type) {
  return document.createElement(type)
}

export function createNode (node) {
  const {
    type,
    props,
    children,
    value
  } = node
  if (isComponent(type)) {
    return createNode(node.children[0])
  }
  const $el = createElment(type)
  setProps($el, props)
  children.length > 0 && appendChildren($el, children)
  value && setTextContent($el, value)
  return $el
}

export default function render (ast) {
  const $root = createNode(ast)
  return $root
}
