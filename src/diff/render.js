import ast from '../template/ast'
import renderDOM from '../dom/index'

export default function render (template, $root) {
  const vdom = ast(template)
  const $dom = renderDOM(vdom)
  $root && $root.appendChild($dom)
  return $dom
}
