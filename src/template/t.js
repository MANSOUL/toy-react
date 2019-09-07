import { tValue } from './utils.js'
import { isComponent } from '../vdom/utils'
import { isFunction } from '../utils/type'

export default function t (statics, ...values) {
  let html = ''
  const components = {}
  const functions = {}
  statics.map((s, i) => {
    const v = values[i]
    if (isComponent(v)) {
      const Component = values[i]
      html += s + Component.name
      components[Component.name] = Component
    } else if (isFunction(v)) {
      const func = values[i]
      html += s + func.name
      functions[func.name] = func
    } else if (v && v.html && v.components) { // 已经经过了t解析后的对象
      html += s + v.html
      for (const k in v.components) {
        if (
          Object.prototype.hasOwnProperty.call(v.components, k) &&
          !Object.prototype.hasOwnProperty.call(components, k)
        ) {
          components[k] = v.components[k]
        }
      }
    } else if (Array.isArray(v) && v[0] && v[0].type) { // this.props.children，使用slot替代
      html += s + '<slot></slot>'
    } else {
      html += s + tValue(v)
    }
  })
  return {
    html,
    components,
    functions
  }
}
