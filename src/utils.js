export const isProperty = key => key !== 'children' && !isEvent(key)
export const isEvent = key => key.startsWith('on')
export const isNew = (prev, next) => key => prev[key] !== next[key]
export const isGone = (prev, next) => key => !(key in next)

export const flat = arr => (
  arr.reduce((prev, next) => {
    if (Array.isArray(next)) {
      return prev.concat(flat(next))
    }
    return prev.concat([next])
  }, [])
)

export const trim = s => {
  return s.replace(/^[\s\n]+|\s+$/g, '')
}

const type = o => Object.prototype.toString.call(o).slice(8, -1).toLowerCase()
export const isPrimitive = o => ['number', 'string', 'boolean'].indexOf(type(o)) !== -1
export const isNullOrUndefined = o => ['null', 'undefined'].indexOf(type(o)) !== -1
