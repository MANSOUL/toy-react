import ast from '../template/ast'

export default function render (template, $root) {
  const vdom = ast(template)
  console.log(vdom)
}
