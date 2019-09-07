export function isComponent (c) {
  if (c && c.prototype && typeof c.prototype.render === 'function') {
    return true
  }
  return false
}
