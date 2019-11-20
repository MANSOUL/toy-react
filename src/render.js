import { TEXT_ELEMENT } from './types'
import { isProperty } from './utils'

export default function render (element, container) {
  const { type, props } = element

  const $dom = type === TEXT_ELEMENT
    ? document.createTextNode('')
    : document.createElement(element.type)

  Object.keys(props)
    .filter(isProperty)
    .forEach(name => {
      $dom[name] = element.props[name]
    })

  props.children.forEach(child => render(child, $dom))

  container.appendChild($dom)
}
