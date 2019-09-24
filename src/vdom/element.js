import _ from '../utils/util'
import $ from '../dom/index'

class Element {
  constructor (tagName, props = {}, children = []) {
    this.tagName = tagName
    this.props = props
    this.children = children
    this.key = props.key
    this.count = children.length
    children.forEach(c => {
      (c instanceof Element) && (c.$parent = this)
    })
  }

  render () {
    var el = document.createElement(this.tagName)
    var props = this.props

    for (var propName in props) {
      var propValue = props[propName]
      $.setAttr(el, propName, propValue)
    }

    _.each(this.children, function (child) {
      var childEl = (child instanceof Element)
        ? child.render()
        : document.createTextNode(child)
      el.appendChild(childEl)
    })

    return el
  }
}

export default Element
