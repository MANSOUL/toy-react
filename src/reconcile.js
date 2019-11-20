import { UPDATE, PLACEMENT, DELETION } from './types'
import { pushDeletion } from './concurrent'

/**
 *
 * @param {Fiber} wipFiber
 * @param {Element[]} elements
 */
export function reconcileChildren (wipFiber, elements) {
  let index = 0
  let prevSibling = null
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child

  while (index < elements.length) {
    const element = elements[index]
    const isSameType = oldFiber && element && oldFiber.type === element.type
    let newFiber = null

    if (isSameType) {
      newFiber = {
        type: oldFiber.type,
        props: element.props,
        dom: oldFiber.dom, // 更新同一个DOM
        parent: wipFiber,
        effectTag: UPDATE,
        alternate: oldFiber
      }
    } else if (element && !isSameType) {
      newFiber = {
        type: element.type,
        props: element.props,
        dom: null,
        parent: wipFiber,
        effectTag: PLACEMENT,
        alternate: null
      }
    } else if (oldFiber && !isSameType) {
      oldFiber.effectTag = DELETION
      pushDeletion(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }
}

/**
 * Fiber
 * {
 *  type: string
 *  props: {
 *    children: Element[]
 *  }
 *  dom: HTMLElement
 *  parent: Fiber
 *  child: Fiber
 *  sibling: Fiber
 *  alternate: Fiber
 *  effectTag: string
 * }
 */
