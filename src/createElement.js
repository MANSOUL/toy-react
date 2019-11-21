import { TEXT_ELEMENT } from './constants'
import { flat } from './utils'

export default function createElement (type, props, ...children) {
  children = flat(children)
  return {
    type,
    props: {
      ...props,
      children: children.map(child => {
        return typeof child === 'string'
          ? createTextElement(child)
          : child
      })
    }
  }
}

function createTextElement (text) {
  return {
    type: TEXT_ELEMENT,
    props: {
      nodeValue: text,
      children: []
    }
  }
}
