(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.toyReact = {}));
}(this, function (exports) { 'use strict';

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
      if (value[0].html) {
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

  function t (statics, ...values) {
    let html = '';
    const components = {};
    statics.map((s, i) => {
      if (typeof values[i] === 'function') {
        const Component = values[i];
        html += s + Component.name;
        components[Component.name] = Component;
      } else {
        html += s + tValue(values[i]);
      }
    });
    return {
      html,
      components
    }
  }

  const TAG_OPEN = 'TagOpen';
  const TAG_CLOSE = 'TagClose';
  const TAG_VALUE = 'TagValue';
  const TAG_ATTR_NAME = 'TagAttrName';
  const TAG_ATTR_VALUE = 'TagAttrValue';

  const REG_TAG_OPEN = /^<([\w]+)\s*([^>]*)\s*>/;
  const REG_TAG_CLOSE = /^<\/([\w]+)\s*>/;
  const REG_TAG_VALUE = /[^<]+/;
  const REG_TAG_ATTR = /([\w-]+)=("?[^"]+"?)/g;

  function trim (str) {
    return str.replace(/^\n+\s+|\s+$/g, '')
  }

  function parseToken (str) {
    if (str.match(REG_TAG_OPEN)) {
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
      const t = {
        type: token.type,
        value: token.value
      };
      start = token.index + token.length;
      tokens.push(t);
      if (token.attrs) {
        tokens = tokens.concat(parseAttr(token.attrs));
      }
      template = template.substr(start);
    }
    return tokens
  }

  function isComponent (c) {
    return typeof c === 'function'
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
          const children = ast(new Component(node.props).render());
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
        props.push(this.lookAhead.value);
        this.match(this.lookAhead.type);
        if (!this.lookAhead || (this.lookAhead.type !== TAG_ATTR_NAME && this.lookAhead.type !== TAG_ATTR_VALUE)) {
          currentNode.props = arrToMap(props);
          break
        }
      }
      return currentNode
    }

    parse (ts, cs) {
      this.tokens = ts;
      this.components = cs;
      this.currentIndex = 0;
      this.lookAhead = this.tokens[this.currentIndex];
      const ast = this.start();
      return ast.children[0]
    }
  }

  function ast (template) {
    return new Syntax().parse(parse(template), template.components)
  }

  class Component {
    constructor (props) {
      this._isComponent = true;
      this.props = props;
    }

    render () {

    }
  }

  function setProps ($el, props) {
    for (const k in props) {
      if (Object.prototype.hasOwnProperty.call(props, k)) {
        $el.setAttribute(k, props[k]);
      }
    }
  }

  function appendChildren ($el, children) {
    const $fragment = document.createDocumentFragment();
    children.map(node => {
      $fragment.appendChild(createNode(node));
    });
    return $el.appendChild($fragment)
  }

  function setTextContent ($el, content) {
    $el.textContent = content;
  }

  function createElment (type) {
    return document.createElement(type)
  }

  function createNode (node) {
    const {
      type,
      props,
      children,
      value
    } = node;
    if (isComponent(type)) {
      return createNode(node.children[0])
    }
    const $el = createElment(type);
    setProps($el, props);
    children.length > 0 && appendChildren($el, children);
    value && setTextContent($el, value);
    return $el
  }

  function render (ast) {
    const $root = createNode(ast);
    return $root
  }

  function render$1 (template, $root) {
    const vdom = ast(template);
    const $dom = render(vdom);
    $root && $root.appendChild($dom);
    return $dom
  }

  var index = {
    t: t,
    ast: ast,
    Component: Component,
    render: render$1
  };
  const t$1 = t;
  const ast$1 = ast;
  const Component$1 = Component;
  const render$2 = render$1;

  exports.Component = Component$1;
  exports.ast = ast$1;
  exports.default = index;
  exports.render = render$2;
  exports.t = t$1;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
