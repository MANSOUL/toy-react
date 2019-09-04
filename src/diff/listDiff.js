export default function listDiff (newList, oldList) {
  const newKeyIndexFree = makeKeyIndexAndFree(newList)
  const oldKeyIndexFree = makeKeyIndexAndFree(oldList)
  const newKeyIndex = newKeyIndexFree.keyIndex
  const newFree = newKeyIndexFree.free
  const oldKeyIndex = oldKeyIndexFree.keyIndex
  // const oldFree = oldKeyIndexFree.free

  const moves = []
  const existChildren = []
  let freeIndex = 0
  let simulateChildren = []

  // 判断旧列表中的项目是否还存在
  oldList.map(item => {
    const key = getItemKey(item)
    if (key) {
      if (Object.prototype.hasOwnProperty.call(newKeyIndex, key)) {
        existChildren.push(newList[newKeyIndex[key]])
      } else {
        existChildren.push(null)
      }
    } else {
      existChildren.push(newFree[freeIndex++] || null)
    }
  })

  simulateChildren = [...existChildren]
  console.log(simulateChildren)

  // 2. remove null child
  simulateChildren.map((item, index) => {
    if (!item) {
      remove(index)
      removeSimulate(index)
    }
  })

  // 3. 新列表和存在的项进行比较，获取移动和删除相关的操作
  // i : newList pointer cursor
  // j : oldList pointer cursor
  let i = 0
  let j = 0
  while (i < newList.length) {
    const item = newList[i]
    const itemKey = getItemKey(item)
    const sItem = simulateChildren[j]
    const sItemKey = getItemKey(sItem)

    if (sItem) {
      if (itemKey === sItemKey) {
        j++
      } else {
        if (!Object.prototype.hasOwnProperty.call(oldKeyIndex, itemKey)) { // 是否为新增item
          insert(i, item)
        } else {
          const nextSItem = simulateChildren[j + 1]
          const nextSItemKey = getItemKey(nextSItem)
          if (itemKey === nextSItemKey) {
            remove(i)
            removeSimulate(j)
            j++
          } else {
            insert(i, item)
          }
        }
      }
    } else {
      insert(i, item)
    }
    i++
  }

  function remove (index) {
    moves.push({ index, type: 0 })
  }

  function removeSimulate (index) {
    simulateChildren.splice(index, 1)
  }

  function insert (index, item) {
    moves.push({ index, item, type: 1 })
  }

  return {
    moves,
    existChildren
  }
}

function makeKeyIndexAndFree (list) {
  const keyIndex = {}
  const free = []
  list.map((item, index) => {
    const key = getItemKey(item)
    if (key) {
      keyIndex[key] = index
    } else {
      free.push(item)
    }
  })
  return {
    keyIndex,
    free
  }
}

function getItemKey (item, key = 'key') {
  if (!item || !key) {
    return undefined
  }
  return item[key]
}
