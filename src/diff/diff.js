import _ from './util'
import patch from './patch'
import listDiff from './listDiff'

export default function diff (newTree, oldTree) {
  const patches = {}
  const index = 0
  dfsWalk(newTree, oldTree, index, patches)
  return patches
}

function dfsWalk (newNode, oldNode, index, patches) {
  const currentPatches = []
  if (newNode === null) {

  } else if (_.isString(oldNode) && _.isString(newNode)) {
    if (newNode !== oldNode) {
      currentPatches.push({
        type: patch.TEXT,
        content: newNode
      })
    }
  } else if (
    oldNode.type === newNode.type &&
    oldNode.key === newNode.key
  ) {
    const propsPatches = diffProps(newNode, oldNode)
    if (propsPatches) {
      currentPatches.push({
        type: patch.PROPS,
        props: propsPatches
      })
    }
    diffChildren(
      oldNode.children,
      newNode.children,
      index,
      patches,
      currentPatches
    )
  } else {
    currentPatches.push({
      type: patch.REPLACE,
      node: newNode
    })
  }
  if (currentPatches.length) {
    patches[index] = currentPatches
  }
}

function diffChildren (newChildren, oldChildren, index, patches, currentPatches) {
  const diffs = listDiff(newChildren, oldChildren)
  newChildren = diffs.existChildren

  if (diffs.moves.length) {
    const reorderPatch = {
      type: patch.REORDER,
      moves: diffs.moves
    }
    currentPatches.push(reorderPatch)
  }

  let leftNode = null
  let currNodeIndex = index
  _.each(oldChildren, function (child, i) {
    const newChild = newChildren[i]

    currNodeIndex = (leftNode && leftNode.count)
      ? currNodeIndex + leftNode.count + 1
      : currNodeIndex + 1

    dfsWalk(newChild, child, currNodeIndex, patches)
    leftNode = child
  })
}

function diffProps (newNode, oldNode) {
  let count = 0
  const oldProps = oldNode.props
  const newProps = newNode.props

  let key, value
  const propsPatches = {}

  for (key in oldProps) {
    value = oldProps[key]
    if (newProps[key] !== value) {
      propsPatches[key] = newProps[key]
      count++
    }
  }

  for (key in newProps) {
    if (!Object.prototype.hasOwnProperty.call(oldProps, key)) {
      propsPatches[key] = newProps[key]
      count++
    }
  }

  if (count === 0) {
    return null
  }

  return propsPatches
}
