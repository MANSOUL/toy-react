export const isProperty = key => key !== 'children' && !isEvent(key)
export const isEvent = key => key.startsWith('on')
export const isNew = (prev, next) => key => prev[key] !== next[key]
export const isGone = (prev, next) => key => !(key in next)
