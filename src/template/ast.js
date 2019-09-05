import lexical from './lexical.js'
import syntax from './syntax.js'

export default function ast (template) {
  return syntax(lexical(template), template.components)
}
