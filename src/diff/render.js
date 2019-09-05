import ast from '../template/ast'

export default function render (template, $root) {
  console.log(template)
  console.log(ast(template))
}
