import { createDOM, setProperty } from './dom'

/**
 * 时间切片
 * 将每个Element切分为一个小的工作单元
 */

let unitOfWork = null

/**
 * 浏览器空闲时执行工作
 * @param {IdleDeadline} deadline
 */
function workLoop (deadline) {
  let shouldPause = false

  while (unitOfWork && !shouldPause) {
    unitOfWork = performUnitOfWork(unitOfWork)
    shouldPause = deadline.timeRemaining() < 1
  }

  window.requestIdleCallback(workLoop)
}

window.requestIdleCallback(workLoop)

/**
 * 每一次工作处理一个Fiber元素
 * 1. 添加DOM
 * 2. 构建Fiber节点
 * 3. 返回下一个Fiber节点
 * @param {Fiber} fiber
 */
function performUnitOfWork (fiber) {
  const { type, dom, parent, props } = fiber
  if (!dom) {
    fiber.dom = createDOM(type)
    setProperty(fiber.dom, props)
  }
  if (parent) {
    parent.dom.appendChild(fiber.dom)
  }

  let index = 0
  let prevSibling = null
  while (index < props.children.length) {
    const element = props.children[index]
    const newFiber = {
      type: element.type,
      props: element.props,
      dom: null,
      parent: fiber
    }

    if (index === 0) {
      fiber.child = newFiber
    } else {
      prevSibling.sibling = newFiber
    }

    prevSibling = newFiber
    index++
  }

  if (fiber.child) {
    return fiber.child
  }
  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}

export function setUnitOfWork (work) {
  unitOfWork = work
}
