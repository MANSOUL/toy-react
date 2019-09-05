import { isComponent } from '../vdom/utils'

export function setProps ($el, props) {
  for (const k in props) {
    if (Object.prototype.hasOwnProperty.call(props, k)) {
      $el.setAttribute(k, props[k])
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
  const $el = createElment(type)
  setProps($el, props)
  children.length > 0 && appendChildren($el, children)
  value && setTextContent($el, value)
  return $el
}

export function render (ast) {
  const $root = createNode(ast)
  return $root
}
