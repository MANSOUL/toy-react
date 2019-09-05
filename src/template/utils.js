export function arrToMap (arr) {
  const o = {}
  for (let index = 0; index < arr.length; index += 2) {
    const key = arr[index]
    const value = arr[index + 1]
    o[key] = value
  }
  return o
}

export function tValue (value) {
  if (value === undefined || value === null) {
    return ''
  }
  // 数组处理
  if (Array.isArray(value)) {
    return value.join('')
  }
  return value
}

export function temlateValue (value) {
  const regString = /^(['"]).*(\1)$/
  const regNumber = /^\d+$/
  if (regString.test(value)) {
    value = value.replace(/^"|"$/g, '')
  } else if (regNumber.test(value)) {
    value = Number(value)
  }
  return value
}

export function isComponent (c) {
  return typeof c === 'function'
}
