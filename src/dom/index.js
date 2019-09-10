const $ = {}
const REG_EVENT = /^on/

export function setProp ($el, k, value) {
  if (k.match(REG_EVENT)) {
    $el.addEventListener(k.replace(REG_EVENT, '').toLowerCase(), value)
  } else {
    $el.setAttribute(k, value)
  }
}

$.setAttr = function setAttr (node, key, value) {
  switch (key) {
    case 'style':
      node.style.cssText = value
      break
    case 'value':
      var tagName = node.tagName || ''
      tagName = tagName.toLowerCase()
      if (
        tagName === 'input' || tagName === 'textarea'
      ) {
        node.value = value
      } else {
        // if it is not a input or textarea, use `setAttribute` to set
        node.setAttribute(key, value)
      }
      break
    default:
      setProp(node, key, value)
      break
  }
}

export default $
