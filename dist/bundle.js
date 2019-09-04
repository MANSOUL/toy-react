(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = global || self, factory(global.toyReact = {}));
}(this, function (exports) { 'use strict';

  const TAG_OPEN = 'TagOpen';
  const TAG_CLOSE = 'TagClose';
  const TAG_VALUE = 'TagValue';
  const TAG_ATTR_NAME = 'TagAttrName';
  const TAG_ATTR_VALUE = 'TagAttrValue';

  function arrToMap(arr) {
    let o = {};
    for (let index = 0; index < arr.length; index += 2) {
      let key = arr[index];
      let value = arr[index + 1];
      o[key] = value;
    }
    return o;
  }

  function tValue(value) {
    if (value === undefined || value === null) {
      return '';
    }
    if (Array.isArray(value)) {
      return value.join('');
    }
    return value;
  }

  function temlateValue(value) {
    let regString = /^(['"]).*(\1)$/;
    let regNumber = /^\d+$/;
    if (regString.test(value)) {
      value = value.replace(/^"|"$/g, '');
    }else if (regNumber.test(value)) {
      value = Number(value);
    }
    // console.log(value);
    return value;
  }

  const REG_TAG_OPEN = /^<([\w]+)\s*([^>]*)\s*>/;
  const REG_TAG_CLOSE = /^<\/([\w]+)\s*>/;
  const REG_TAG_VALUE = /[^<]+/;
  const REG_TAG_ATTR = /([\w-]+)=("?[^\s]+"?)/g;

  function trim(str) {
    return str.replace(/^\s+|\s+$/g, '');
  }

  function parseToken (str) {
    if (str.match(REG_TAG_OPEN)) {
      let matches = str.match(REG_TAG_OPEN);
      return {
        type: TAG_OPEN,
        value: matches[1],
        index: matches.index,
        length: matches[0].length,
        attrs: matches[2]
      };
    } else if (str.match(REG_TAG_CLOSE)) {
       let matches = str.match(REG_TAG_CLOSE);
       return {
         type: TAG_CLOSE,
         value: matches[1],
         index: matches.index,
         length: matches[0].length
       };
     } else if (str.match(REG_TAG_VALUE)) {
      let matches = str.match(REG_TAG_VALUE);
      return {
        type: TAG_VALUE,
        value: matches[0],
        index: matches.index,
        length: matches[0].length
      };
    }
    throw SyntaxError('语法错误');
  }

  function parseAttr (attr) {
    let m = null;
    let attrs = [];
    while(m = REG_TAG_ATTR.exec(attr)) {
      attrs.push({
        type: TAG_ATTR_NAME,
        value: m[1]
      });
      attrs.push({
        type: TAG_ATTR_VALUE,
        value: temlateValue(m[2])
      });
    }
    return attrs;
  }

  function parse (template) { 
    let tokens = [];
    let start = 0;

    while (template.length > 0) {
      template = trim(template);
      let token = parseToken(template);
      let t = {
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
    return tokens;
  }

  let currentIndex, lookAhead, tokens;

  const nextToken = () => {
    lookAhead = tokens[++currentIndex];
  };

  const match = type => {
    if (lookAhead && lookAhead.type === type) {
      nextToken();
    } else {
      throw SyntaxError('语法错误');
    }
  };

  const LL = {
    start () {
      let node = { type: 'root', value: null, children: [] };
      LL.tags(node);
      return node;
    },
    tags (currentNode) {
      while (lookAhead) { // 在TAG_CLOSE后，处理多个token
        let node = { type: lookAhead.value, value: null, props: null, children: [] };
        node = LL.tag(node);
        currentNode.children.push(node);
        if (lookAhead && lookAhead.type === TAG_CLOSE) {
          break;
        }
      }
      return currentNode;
    },
    tag (currentNode) {
      match(TAG_OPEN);
      if (lookAhead && lookAhead.type === TAG_ATTR_NAME) { // 处理props
        currentNode = LL.attrs(currentNode);
      } 
      if (lookAhead && lookAhead.type === TAG_OPEN) { // ahead 为开始，则其为当前的子tag
        currentNode = LL.tags(currentNode);
      }
      else { // ahead 为 value
        currentNode.value = lookAhead.value;
        match(TAG_VALUE); // 进入token
      }
      match(TAG_CLOSE); // ahead 为 结束
      return currentNode;
    },
    attrs (currentNode) {
      let props = [];
      while (lookAhead) {
        props.push(lookAhead.value);
        match(lookAhead.type);
        if (!lookAhead || (lookAhead.type !== TAG_ATTR_NAME && lookAhead.type !== TAG_ATTR_VALUE)) {
          currentNode.props = arrToMap(props);
          break;
        }
      }
      return currentNode;
    }
  };

  function generateAST (ts) {
    tokens = ts;
    currentIndex = 0;
    lookAhead = tokens[currentIndex];
    let ast = LL.start();
    return ast;
  }

  function t (statics, ...values) {
    let html = '';
    statics.map((s, i) => {
      html += s + tValue(values[i]);
    });
    return html;
  }

  function ast (template) {
    return generateAST(parse(template)).children[0];
  }

  exports.ast = ast;
  exports.t = t;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
