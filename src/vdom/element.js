class Element {
  constructor (tagName, props = {}, children = []) {
    this.tagName = tagName
    this.props = props
    this.children = children
    this.key = props.key
    let count = 0
    children.map((c, i) => {
      if (c instanceof Element) {
        count += c.count
      } else {
        children[i] = '' + c
      }
    })
    this.count = count
  }
}

export default Element
