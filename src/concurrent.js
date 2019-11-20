import { createDOM, updateDOM } from './dom'
import { reconcileChildren } from './reconcile'
import { UPDATE, PLACEMENT, DELETION } from './types'

/**
 * 时间切片
 * 将每个Element切分为一个小的工作单元
 */

let unitOfWork = null
let wipRoot = null // 保存fiber tree的根结点， work in progress root
const deletions = []
let currentRoot = null // 记录当前工作到哪个节点

function commitRoot () {
  deletions.forEach(commitWork)
  commitWork(wipRoot.child)
  currentRoot = wipRoot
  wipRoot = null
}

/**
 * 操作节点，更新，删除，添加
 * @param {Fiber} fiber
 */
function commitWork (fiber) {
  if (!fiber) {
    return
  }

  // 函数组件没有dom
  // 为函数组件的子元素循环查找到父节点
  let fiberParentDOM = fiber.parent
  if (!fiberParentDOM.dom) {
    fiberParentDOM = fiberParentDOM.parent
  }
  const parentDOM = fiberParentDOM.dom

  // function component don't have dom
  if (fiber.effectTag === PLACEMENT && fiber.dom) {
    parentDOM.appendChild(fiber.dom)
  } else if (fiber.effectTag === UPDATE) {
    updateDOM(fiber.dom, fiber.alternate.props, fiber.props)
  } else if (fiber.effectTag === DELETION) {

  }
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

/**
 * 浏览器空闲时执行工作
 * @param {IdleDeadline} deadline
 */
function workLoop (deadline) {
  let shouldPause = false

  while (unitOfWork && !shouldPause) {
    unitOfWork = performUnitOfWork(unitOfWork)
    shouldPause = deadline.timeRemaining() < 20
  }

  // 避免渲染部分UI
  if (!unitOfWork && wipRoot) {
    commitRoot()
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
  const isFunctionComponent = fiber.type instanceof Function

  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
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

function updateFunctionComponent (fiber) {
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function updateHostComponent (fiber) {
  const { type, dom, props } = fiber
  if (!dom) {
    fiber.dom = createDOM(type)
    updateDOM(fiber.dom, {}, props)
  }
  reconcileChildren(fiber, props.children)
}

export function setUnitOfWork (work) {
  unitOfWork = work
}

export function setWipRoot (fiberRoot) {
  wipRoot = fiberRoot
}

export function pushDeletion (fiber) {
  deletions.push(fiber)
}
