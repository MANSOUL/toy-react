export default function diff (newTree, oldTree) {
  const patches = {}
  const index = 0
  dfsWalk(newTree, oldTree, index, patches)
  return patches
}

function dfsWalk (newNode, oldNode, index, patches) {

}

function diffChildren (newChildren, oldChildren, index, patches, currentPatches) {

}

function diffProps (newProps, oldProps) {

}
