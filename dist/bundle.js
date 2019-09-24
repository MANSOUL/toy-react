(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.toyReact = factory());
}(this, function () { 'use strict';

  function arrToMap (arr) {
    const o = {};
    for (let index = 0; index < arr.length; index += 2) {
      const key = arr[index];
      const value = arr[index + 1];
      o[key] = value;
    }
    return o
  }

  function tValue (value) {
    if (value === undefined || value === null) {
      return ''
    }
    // 数组处理
    if (Array.isArray(value)) {
      if (value[0] && value[0].html) {
        let h = '';
        value.map(item => (h += item.html));
        return h
      }
      return value.join('')
    }
    return value
  }

  function temlateValue (value) {
    const regString = /^(['"]).*(\1)$/;
    const regNumber = /^\d+$/;
    if (regString.test(value)) {
      value = value.replace(/^"|"$/g, '');
    } else if (regNumber.test(value)) {
      value = Number(value);
    }
    return value
  }

  function isComponent (c) {
    if (c && c.prototype && typeof c.prototype.render === 'function') {
      return true
    }
    return false
  }

  function type (o) {
    return Object.prototype.toString.call(o).slice(8, -1)
  }

  function isFunction (f) {
    return type(f) === 'Function'
  }

  function t (statics, ...values) {
    let html = '';
    const components = {};
    const functions = {};
    statics.map((s, i) => {
      const v = values[i];
      if (isComponent(v)) {
        const Component = values[i];
        html += s + Component.name;
        components[Component.name] = Component;
      } else if (isFunction(v)) {
        const func = values[i];
        html += s + func.name;
        functions[func.name] = func;
      } else if (v && v.html && v.components) { // 已经经过了t解析后的对象
        html += s + v.html;
        for (const k in v.components) {
          if (
            Object.prototype.hasOwnProperty.call(v.components, k) &&
            !Object.prototype.hasOwnProperty.call(components, k)
          ) {
            components[k] = v.components[k];
          }
        }
      } else if (Array.isArray(v) && v[0] && v[0].type) { // this.props.children，使用slot替代
        html += s + '<slot></slot>';
      } else {
        html += s + tValue(v);
      }
    });
    return {
      html,
      components,
      functions
    }
  }

  const TAG_SINGLE = 'TagSingle';
  const TAG_OPEN = 'TagOpen';
  const TAG_CLOSE = 'TagClose';
  const TAG_VALUE = 'TagValue';
  const TAG_ATTR_NAME = 'TagAttrName';
  const TAG_ATTR_VALUE = 'TagAttrValue';

  const REG_TAG_SINGLE = /^<([\w]+)\s*([^>]*)\s*\/>/; // 自闭合标签
  const REG_TAG_OPEN = /^<([\w]+)\s*([^>]*)\s*>/;
  const REG_TAG_CLOSE = /^<\/([\w]+)\s*>/;
  const REG_TAG_VALUE = /[^<]+/;
  const REG_TAG_ATTR = /([\w-]+)=("?[^"]+"?)/g;

  function trim (str) {
    return str.replace(/^\n+\s+|\s+$/g, '')
  }

  function parseToken (str) {
    if (str.match(REG_TAG_SINGLE)) {
      const matches = str.match(REG_TAG_SINGLE);
      return {
        type: TAG_SINGLE,
        value: matches[1],
        index: matches.index,
        length: matches[0].length,
        attrs: matches[2]
      }
    } else if (str.match(REG_TAG_OPEN)) {
      const matches = str.match(REG_TAG_OPEN);
      return {
        type: TAG_OPEN,
        value: matches[1],
        index: matches.index,
        length: matches[0].length,
        attrs: matches[2]
      }
    } else if (str.match(REG_TAG_CLOSE)) {
      const matches = str.match(REG_TAG_CLOSE);
      return {
        type: TAG_CLOSE,
        value: matches[1],
        index: matches.index,
        length: matches[0].length
      }
    } else if (str.match(REG_TAG_VALUE)) {
      const matches = str.match(REG_TAG_VALUE);
      return {
        type: TAG_VALUE,
        value: matches[0],
        index: matches.index,
        length: matches[0].length
      }
    }
    throw SyntaxError('词法错误')
  }

  function parseAttr (attr) {
    let m = null;
    const attrs = [];
    // eslint-disable-next-line no-cond-assign
    while (m = REG_TAG_ATTR.exec(attr)) {
      attrs.push({
        type: TAG_ATTR_NAME,
        value: m[1]
      });
      attrs.push({
        type: TAG_ATTR_VALUE,
        value: temlateValue(m[2])
      });
    }
    return attrs
  }

  function parse (templateObj) {
    let template = templateObj.html;
    let tokens = [];
    let start = 0;
    while (template.length > 0) {
      template = trim(template);
      const token = parseToken(template);
      if (token.type === TAG_SINGLE) { // 自闭合标签
        tokens.push({
          type: TAG_OPEN,
          value: token.value
        });
        if (token.attrs) { // 继续解析属性
          tokens = tokens.concat(parseAttr(token.attrs));
        }
        tokens.push({
          type: TAG_CLOSE,
          value: token.value
        });
      } else {
        const t = {
          type: token.type,
          value: token.value
        };
        tokens.push(t);
        if (token.attrs) { // 继续解析属性
          tokens = tokens.concat(parseAttr(token.attrs));
        }
      }
      start = token.index + token.length;
      template = template.substr(start);
    }
    return tokens
  }

  /* eslint-disable no-unmodified-loop-condition */

  class Syntax {
    nextToken () {
      const { tokens } = this;
      this.lookAhead = tokens[++this.currentIndex];
    }

    match (type) {
      if (this.lookAhead && this.lookAhead.type === type) {
        this.nextToken();
      } else {
        throw SyntaxError('语法错误')
      }
    }

    start () {
      const node = { type: 'root', value: null, children: [] };
      this.tags(node);
      return node
    }

    tags (currentNode) {
      while (this.lookAhead) { // 在TAG_CLOSE后，处理多个token
        const value = this.lookAhead.value;
        const Component = this.components[value]; // 用于判断是组件，还是普通元素
        let node = {
          type: Component || value,
          value: null,
          props: {},
          children: []
        };
        node = this.tag(node);

        // 当前节点解析完成后判断它是否为组件
        if (isComponent(node.type)) {
          const propsChildren = [...node.children]; // 如果是组件，那么它里面的children，就放到props。children中去
          node.children = [];
          if (node.value) {
            propsChildren.push(node.value);
          }
          node.props.children = propsChildren;
          const oComponent = new Component(node.props);
          const children = ast(oComponent.render());
          // 查找slot并将slot替换的位置替换为props.children
          const slotIndex = children.children.findIndex(c => c.type === 'slot');
          if (~slotIndex) {
            children.children.splice(slotIndex, 1, ...node.props.children);
          }
          // 记录下当前组件实例用于后续的更新渲染
          node.$instance = oComponent;
          node.children.push(children);
        }

        currentNode.children.push(node);
        if (this.lookAhead && this.lookAhead.type === TAG_CLOSE) {
          break
        }
      }
      return currentNode
    }

    tag (currentNode) {
      this.match(TAG_OPEN);
      if (this.lookAhead && this.lookAhead.type === TAG_ATTR_NAME) { // 处理props
        currentNode = this.attrs(currentNode);
      }
      if (this.lookAhead && this.lookAhead.type === TAG_OPEN) { // ahead 为开始，则其为当前的子tag
        currentNode = this.tags(currentNode);
      } else if (this.lookAhead && this.lookAhead.type === TAG_VALUE) { // ahead 为 value
        currentNode.value = this.lookAhead.value;
        this.match(TAG_VALUE); // 进入token
      }
      this.match(TAG_CLOSE); // ahead 为 结束
      return currentNode
    }

    attrs (currentNode) {
      const props = [];
      while (this.lookAhead) {
        const { value, type } = this.lookAhead;
        if (this.functions[value]) {
          props.push(this.functions[value]);
        } else {
          props.push(value);
        }
        this.match(type);
        if (!this.lookAhead || (this.lookAhead.type !== TAG_ATTR_NAME && this.lookAhead.type !== TAG_ATTR_VALUE)) {
          currentNode.props = arrToMap(props);
          break
        }
      }
      return currentNode
    }

    parse (ts, cs, fs) {
      this.tokens = ts;
      this.components = cs;
      this.functions = fs;
      this.currentIndex = 0;
      this.lookAhead = this.tokens[this.currentIndex];
      const ast = this.start();
      return ast.children[0]
    }
  }

  function ast (template) {
    return new Syntax().parse(parse(template), template.components, template.functions)
  }

  class Component {
    constructor (props) {
      this._isComponent = true;
      this.props = props;
    }

    render () {

    }
  }

  const _ = {};

  _.type = function (obj) {
    return Object.prototype.toString.call(obj).replace(/\[object\s|\]/g, '')
  };

  _.isArray = function isArray (list) {
    return _.type(list) === 'Array'
  };

  _.slice = function slice (arrayLike, index) {
    return Array.prototype.slice.call(arrayLike, index)
  };

  _.truthy = function truthy (value) {
    return !!value
  };

  _.isString = function isString (list) {
    return _.type(list) === 'String'
  };

  _.each = function each (array, fn) {
    for (var i = 0, len = array.length; i < len; i++) {
      fn(array[i], i);
    }
  };

  _.toArray = function toArray (listLike) {
    if (!listLike) {
      return []
    }

    var list = [];

    for (var i = 0, len = listLike.length; i < len; i++) {
      list.push(listLike[i]);
    }

    return list
  };

  const $ = {};
  const REG_EVENT = /^on/;

  function setProp ($el, k, value) {
    if (k.match(REG_EVENT)) {
      $el.addEventListener(k.replace(REG_EVENT, '').toLowerCase(), value);
    } else {
      $el.setAttribute(k, value);
    }
  }

  $.setAttr = function setAttr (node, key, value) {
    switch (key) {
      case 'style':
        node.style.cssText = value;
        break
      case 'value':
        var tagName = node.tagName || '';
        tagName = tagName.toLowerCase();
        if (
          tagName === 'input' || tagName === 'textarea'
        ) {
          node.value = value;
        } else {
          // if it is not a input or textarea, use `setAttribute` to set
          node.setAttribute(key, value);
        }
        break
      default:
        setProp(node, key, value);
        break
    }
  };

  class Element {
    constructor (tagName, props = {}, children = []) {
      this.tagName = tagName;
      this.props = props;
      this.children = children;
      this.key = props.key;
      this.count = children.length;
      children.forEach(c => {
        (c instanceof Element) && (c.$parent = this);
      });
    }

    render () {
      var el = document.createElement(this.tagName);
      var props = this.props;

      for (var propName in props) {
        var propValue = props[propName];
        $.setAttr(el, propName, propValue);
      }

      _.each(this.children, function (child) {
        var childEl = (child instanceof Element)
          ? child.render()
          : document.createTextNode(child);
        el.appendChild(childEl);
      });

      return el
    }
  }

  function vdom (node) {
    const create = function (currentNode) {
      const children = currentNode.children;
      const elementChildren = children.map(child => {
        return create(child)
      });
      if (currentNode.value) {
        elementChildren.push(currentNode.value);
      }
      if (isComponent(currentNode.type)) {
        // 在此处为组件重新设置一个render函数，将解析过后的Element在这个函数中定义，
        // 那么在下一次重新渲染时就不需要在重新解析模版了
        currentNode.$instance.$vdom = elementChildren[0];
        return elementChildren[0]
      } else {
        const element = new Element(currentNode.type, currentNode.props, elementChildren);
        return element
      }
    };
    return create(node)
  }

  function renderVDOM(vdom, $root) {
    if($root.firstChild && $root.firstChild.nodeType === 1) {
      $root.replaceChild(vdom.render(), $root.firstChild);
    } else {
      $root.appendChild(vdom.render());
    }
  }

  function render (template, $root) {
    const vdomTree = vdom(ast(template));
    renderVDOM(vdomTree, $root);
    window.vdomTree = vdomTree;
    return vdomTree
  }

  var index = {
    t,
    ast,
    Component,
    render,
    renderVDOM,
    vdom
  };

  return index;

}));
