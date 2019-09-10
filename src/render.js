import vdom from './vdom/vdom'

export default function render (template, $root) {
  const vdomTree = vdom(template)
  $root.appendChild(vdomTree.render())
  return vdomTree
}
