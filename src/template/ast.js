import lexical from './lexical.js'
// import syntax from './syntax.js'
import Syntax from './syntaxAll'

export default function ast (template) {
  // return syntax(lexical(template), template.components)
  return new Syntax().parse(lexical(template), template.components)
}
