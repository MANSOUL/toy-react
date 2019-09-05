import { tValue } from './utils.js'

export default function t (statics, ...values) {
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
