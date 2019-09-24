import vdom from './vdom/vdom'
import ast from './template/ast'

export function renderVDOM(vdom, $root) {
  if($root.firstChild && $root.firstChild.nodeType === 1) {
    $root.replaceChild(vdom.render(), $root.firstChild)
  } else {
    $root.appendChild(vdom.render())
  }
}

export default function render (template, $root) {
  const vdomTree = vdom(ast(template))
  renderVDOM(vdomTree, $root)
  window.vdomTree = vdomTree
  return vdomTree
}
