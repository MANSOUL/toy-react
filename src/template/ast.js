import lexical from './lexical.js'
import Syntax from './syntax.js'

export default function ast (template) {
  return new Syntax().parse(lexical(template), template.components, template.functions)
}
