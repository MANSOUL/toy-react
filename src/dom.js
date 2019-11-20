import { TEXT_ELEMENT } from './types'
import { isProperty, isNew, isGone, isEvent } from './utils'

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
 * @param {HTMLElement} dom
 * @param {Object} oldProps
 * @param {Object} newProps
 */
export function updateDOM (dom, oldProps, newProps) {
  Object.keys(oldProps)
    .filter(isEvent)
    .filter(key => !(key in newProps) || oldProps[key] !== newProps[key])
    .forEach(key => {
      const event = key.toLowerCase().substring(2)
      dom.removeEventListener(event, oldProps[key])
    })

  Object.keys(oldProps)
    .filter(isProperty)
    .filter(isGone(oldProps, newProps))
    .forEach(key => {
      dom[key] = ''
    })

  Object.keys(newProps)
    .filter(isEvent)
    .filter(isNew(oldProps, newProps))
    .forEach(key => {
      const event = key.toLowerCase().substring(2)
      dom.addEventListener(event, newProps[key])
    })

  Object.keys(newProps)
    .filter(isProperty)
    .filter(isNew(oldProps, newProps))
    .forEach(key => {
      dom[key] = newProps[key]
    })
}
