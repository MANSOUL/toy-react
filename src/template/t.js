import lexical from './lexical.js'
import syntax from './syntax.js'
import { tValue } from './utils.js'

export function t (statics, ...values) {
  let html = ''
  const components = {}
  statics.map((s, i) => {
    if (typeof values[i] === 'function') {
      const Component = values[i]
      html += s + Component.name
      components[Component.name] = Component
    } else {
      html += s + tValue(values[i])
    }
  })
  return {
    html,
    components
  }
}

export function ast (template) {
  return syntax(lexical(template)).children[0]
}
