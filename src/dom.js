import { TEXT_ELEMENT } from './types'
import { isProperty } from './utils'

/**
 *
 * @param {String} type
 */
export function createDOM (type) {
  const $dom = type === TEXT_ELEMENT
    ? document.createTextNode('')
    : document.createElement(type)

  return $dom
}

/**
 *
 * @param {HTMLElement} $dom
 * @param {Object} props
 */
export function setProperty ($dom, props) {
  Object.keys(props)
    .filter(isProperty)
    .forEach(name => {
      $dom[name] = props[name]
    })
}
