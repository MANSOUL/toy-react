import { tValue } from './utils.js'
import { isComponent } from '../vdom/utils'

export default function t (statics, ...values) {
  let html = ''
  const components = {}
  statics.map((s, i) => {
    if (isComponent(values[i])) {
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
