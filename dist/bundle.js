
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Treact = factory());
}(this, (function () { 'use strict';

  const TEXT_ELEMENT = 'TEXT_ELEMENT';
  const UPDATE = 'UPDATE';
  const PLACEMENT = 'PLACEMENT';
  const DELETION = 'DELETION';

  const isProperty = key => key !== 'children' && !isEvent(key);
  const isEvent = key => key.startsWith('on');
  const isNew = (prev, next) => key => prev[key] !== next[key];
  const isGone = (prev, next) => key => !(key in next);

  const flat = arr => (
    arr.reduce((prev, next) => {
      if (Array.isArray(next)) {
        return prev.concat(flat(next))
      }
      return prev.concat([next])
    }, [])
  );

  const trim = s => {
    return s.replace(/^[\s\n]+|\s+$/g, '')
  };

  const type = o => Object.prototype.toString.call(o).slice(8, -1).toLowerCase();
  const isPrimitive = o => ['number', 'string', 'boolean'].indexOf(type(o)) !== -1;
  const isNullOrUndefined = o => ['null', 'undefined'].indexOf(type(o)) !== -1;

  function createElement (type, props, ...children) {
    children = flat(children);
    return {
      isElement: true,
      type,
      props: {
        ...props,
        children: children.map(child => {
          return typeof child === 'string'
            ? createTextElement(child)
            : child
        })
      }
    }
  }

  function createTextElement (text) {
    return {
      isElement: true,
      type: TEXT_ELEMENT,
      props: {
        nodeValue: text,
        children: []
      }
    }
  }

  /**
   *
   * @param {String} type
   */
  function createDOM (type) {
    const $dom = type === TEXT_ELEMENT
      ? document.createTextNode('')
      : document.createElement(type);

    return $dom
  }

  /**
   *
   * @param {HTMLElement} dom
   * @param {Object} oldProps
   * @param {Object} newProps
   */
  function updateDOM (dom, oldProps, newProps) {
    Object.keys(oldProps)
      .filter(isEvent)
      .filter(key => !(key in newProps) || oldProps[key] !== newProps[key])
      .forEach(key => {
        const event = key.toLowerCase().substring(2);
        dom.removeEventListener(event, oldProps[key]);
      });

    Object.keys(oldProps)
      .filter(isProperty)
      .filter(isGone(oldProps, newProps))
      .forEach(key => {
        dom[key] = '';
      });

    Object.keys(newProps)
      .filter(isEvent)
      .filter(isNew(oldProps, newProps))
      .forEach(key => {
        const event = key.toLowerCase().substring(2);
        dom.addEventListener(event, newProps[key]);
      });

    Object.keys(newProps)
      .filter(isProperty)
      .filter(isNew(oldProps, newProps))
      .forEach(key => {
        dom[key] = newProps[key];
      });
  }

  /**
   * 时间切片
   * 将每个Element切分为一个小的工作单元
   */

  /**
    * Fiber
    * {
    *  type: string
    *  props: {
    *    children: Element[]
    *  }
    *  dom: HTMLElement
    *  parent: Fiber
    *  child: Fiber
    *  sibling: Fiber
    *  alternate: Fiber
    *  effectTag: string
    * }
    */

  let unitOfWork = null; // 时间切片：当前所要进行工作的Fiber单元
  let wipRoot = null; // 保存fiber tree的根结点， work in progress root
  const deletions = [];
  let currentRoot = null; // 记录当前工作到哪个节点

  function commitRoot () {
    let deletion = null;
    while ((deletion = deletions.shift())) {
      commitWork(deletion);
    }
    commitWork(wipRoot.child);
    currentRoot = wipRoot;
    wipRoot = null;
  }

  /**
   * 操作节点，更新，删除，添加
   * @param {Fiber} fiber
   */
  function commitWork (fiber) {
    if (!fiber) {
      return
    }

    // 函数组件没有dom
    // 为函数组件的子元素循环查找到父节点
    let fiberParentDOM = fiber.parent;
    if (!fiberParentDOM.dom) {
      fiberParentDOM = fiberParentDOM.parent;
    }
    const parentDOM = fiberParentDOM.dom;

    // function component don't have dom
    if (fiber.effectTag === PLACEMENT && fiber.dom) {
      parentDOM.appendChild(fiber.dom);
    } else if (fiber.effectTag === UPDATE) {
      updateDOM(fiber.dom, fiber.alternate.props, fiber.props);
    } else if (fiber.effectTag === DELETION) {
      commitDeletion(fiber, parentDOM);
      return
    }
    commitWork(fiber.child);
    commitWork(fiber.sibling);
  }

  function commitDeletion (fiber, domParent) {
    if (fiber.dom) {
      domParent.removeChild(fiber.dom);
    } else {
      commitDeletion(fiber.child, domParent);
    }
  }

  /**
   * 浏览器空闲时执行工作
   * @param {IdleDeadline} deadline
   */
  function workLoop (deadline) {
    let shouldPause = false;

    while (unitOfWork && !shouldPause) {
      unitOfWork = performUnitOfWork(unitOfWork);
      shouldPause = deadline.timeRemaining() < 1;
    }

    // 避免渲染部分UI
    if (!unitOfWork && wipRoot) {
      commitRoot();
    }

    window.requestIdleCallback(workLoop);
  }

  window.requestIdleCallback(workLoop);

  /**
   * 每一次工作处理一个Fiber元素
   * 1. 添加DOM
   * 2. 构建Fiber节点
   * 3. 返回下一个Fiber节点
   * @param {Fiber} fiber
   */
  function performUnitOfWork (fiber) {
    const isFunctionComponent = fiber.type instanceof Function;

    if (isFunctionComponent) {
      updateFunctionComponent(fiber);
    } else {
      updateHostComponent(fiber);
    }

    if (fiber.child) {
      return fiber.child
    }
    let nextFiber = fiber;
    while (nextFiber) {
      if (nextFiber.sibling) {
        return nextFiber.sibling
      }
      nextFiber = nextFiber.parent;
    }
  }

  let wipFiber = null; // 当前使用到的函数组件
  let hookIndex = 0; // 当前组件的钩子下标
  function updateFunctionComponent (fiber) {
    wipFiber = fiber;
    hookIndex = 0;
    wipFiber.hooks = [];
    const children = [fiber.type(fiber.props)];
    reconcileChildren(fiber, children);
  }

  function useState (initial) {
    const oldHook =
      wipFiber.alternate &&
      wipFiber.alternate.hooks &&
      wipFiber.alternate.hooks[hookIndex];

    const hook = {
      state: oldHook ? oldHook.state : initial,
      queue: []
    };

    // 合并执行多个 setState
    const actions = oldHook ? oldHook.queue : [];
    actions.forEach(action => {
      hook.state = action(hook.state);
    });

    const setState = action => {
      hook.queue.push(action);
      // 更新
      wipRoot = {
        dom: currentRoot.dom,
        props: currentRoot.props,
        alternate: currentRoot
      };
      unitOfWork = wipRoot;
    };

    wipFiber.hooks.push(hook);
    hookIndex++;
    return [hook.state, setState]
  }

  function updateHostComponent (fiber) {
    const { type, dom, props } = fiber;
    if (!dom) {
      fiber.dom = createDOM(type);
      updateDOM(fiber.dom, {}, props);
    }
    reconcileChildren(fiber, props.children);
  }

  /**
   *
   * @param {Fiber} wipFiber
   * @param {Element[]} elements
   */
  function reconcileChildren (wipFiber, elements) {
    let index = 0;
    let prevSibling = null;
    let oldFiber = wipFiber.alternate && wipFiber.alternate.child;

    while (index < elements.length || oldFiber != null) {
      const element = elements[index];
      const isSameType = oldFiber && element && oldFiber.type === element.type;
      let newFiber = null;

      if (isSameType) {
        newFiber = {
          type: oldFiber.type,
          props: element.props,
          dom: oldFiber.dom, // 更新同一个DOM
          parent: wipFiber,
          effectTag: UPDATE,
          alternate: oldFiber
        };
      } else if (element && !isSameType) {
        newFiber = {
          type: element.type,
          props: element.props,
          dom: null,
          parent: wipFiber,
          effectTag: PLACEMENT,
          alternate: null
        };
      } else if (oldFiber && !isSameType) {
        oldFiber.effectTag = DELETION;
        deletions.push(oldFiber);
      }

      if (oldFiber) {
        oldFiber = oldFiber.sibling;
      }

      if (index === 0) {
        wipFiber.child = newFiber;
      } else if (prevSibling != null) {
        prevSibling.sibling = newFiber;
      }

      prevSibling = newFiber;
      index++;
    }
  }

  function render (element, container) {
    const fiberRoot = {
      dom: container,
      props: {
        children: [element]
      },
      alternate: null
    };
    unitOfWork = fiberRoot;
    wipRoot = fiberRoot;
  }

  const regTagStart = /^<(\w+)\s*([^>]*)\s*>/;
  const regTagClose = /^<\/(\w+)\s*>/;
  const regTagValue = /^[^<]*/;
  const regTagAttr = /([\w-]+)="([^"]+)"/g;
  const TAG_START = 'TAG_START';
  const TAG_CLOSE = 'TAG_CLOSE';
  const TAG_VALUE = 'TAG_VALUE';
  const TAG_ATTR_NAME = 'TAG_ATTR_NAME';
  const TAG_ATTR_VALUE = 'TAG_ATTR_VALUE';
  const isObjectValue = key => /PresetObject\d+/.test(key);
  const getObjectValue = (objects, key) => {
    const regExp = /PresetObject\d+/;
    return objects[regExp.exec(key)[0]]
  };
  let globalObjects = null;

  const parseToken = template => {
    let type = '';
    let matches = null;
    let value = null;
    let attrs = '';

    if ((matches = template.match(regTagStart))) {
      type = TAG_START;
      value = matches[1];
      attrs = matches[2];
    } else if ((matches = template.match(regTagClose))) {
      type = TAG_CLOSE;
      value = matches[1];
    } else if ((matches = template.match(regTagValue))) {
      type = TAG_VALUE;
      value = matches[0];
    } else {
      throw new TypeError('lexical error')
    }

    return {
      type,
      value,
      subIndex: matches.index + matches[0].length,
      attrs
    }
  };

  function parseAttr (attr) {
    let m = null;
    const attrs = [];

    while ((m = regTagAttr.exec(attr))) {
      attrs.push({
        type: TAG_ATTR_NAME,
        value: m[1]
      });
      attrs.push({
        type: TAG_ATTR_VALUE,
        value: m[2]
      });
    }
    return attrs
  }

  const parseLexical = template => {
    let tokens = [];
    let temp = trim(template);
    while (temp.length) {
      temp = trim(temp);
      const token = parseToken(temp);
      temp = temp.substring(token.subIndex);
      tokens.push(token);
      if (token.type === TAG_START) {
        tokens = tokens.concat(parseAttr(token.attrs));
      }
    }
    return tokens
  };

  const parseSyntax = tokens => {
    let index = 0;
    let nextToken = tokens[index];
    let current = null;
    let attrName = '';

    const tree = current = {
      type: 'root',
      children: []
    };

    const goNext = () => {
      return tokens[++index]
    };

    while (nextToken) {
      let value = nextToken.value;
      if (isObjectValue(value)) {
        value = getObjectValue(globalObjects, value);
      }
      if (nextToken.type === TAG_START) {
        const tempRoot = {
          type: value,
          children: [],
          props: {},
          parent: current
        };
        current.children.push(tempRoot);
        current = tempRoot;
      } else if (nextToken.type === TAG_CLOSE) {
        const tempRoot = current;
        current = tempRoot.parent;
        delete tempRoot.parent;
      } else if (nextToken.type === TAG_ATTR_NAME) {
        attrName = nextToken.value;
      } else if (nextToken.type === TAG_ATTR_VALUE) {
        current.props[attrName] = value;
      } else if (nextToken.type === TAG_VALUE) {
        current.children.push(value);
      }

      nextToken = goNext();
    }

    return tree.children[0]
  };

  const isExistIn = (objects, value) => {
    const keys = Object.keys(objects);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (objects[k] === value) {
        return k
      }
    }
    return null
  };

  const preset = (statics, ...entities) => {
    const objects = {};
    let template = '';
    let count = 0;
    let i = 0;
    for (; i < entities.length; i++) {
      let e = entities[i];
      if (isNullOrUndefined(e)) {
        e = '';
      }

      if (!isPrimitive(e)) {
        const existkey = isExistIn(objects, e);
        if (existkey) {
          e = existkey;
        } else {
          const key = `PresetObject${count++}`;
          objects[key] = e;
          e = key;
        }
      }
      template += (statics[i] + e);
    }
    template += statics[i];
    globalObjects = objects;
    return template
  };

  const convertToElements = tree => {
    if (tree.isElement) {
      return tree
    }
    const children = tree.children ? flat(tree.children).map(convertToElements) : [];
    return typeof tree === 'object' ? createElement(tree.type, tree.props, ...children) : tree
  };

  const t = (statics, ...entities) => {
    const template = preset(statics, ...entities);
    const tokens = parseLexical(template);
    const syntax = parseSyntax(tokens);
    return convertToElements(syntax)
  };

  var index = {
    createElement,
    render,
    useState,
    t
  };

  return index;

})));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY29uc3RhbnRzLmpzIiwiLi4vc3JjL3V0aWxzLmpzIiwiLi4vc3JjL2NyZWF0ZUVsZW1lbnQuanMiLCIuLi9zcmMvZG9tLmpzIiwiLi4vc3JjL3JlY29uY2lsZS5qcyIsIi4uL3NyYy90ZW1wbGF0ZS90LmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBURVhUX0VMRU1FTlQgPSAnVEVYVF9FTEVNRU5UJ1xuZXhwb3J0IGNvbnN0IFVQREFURSA9ICdVUERBVEUnXG5leHBvcnQgY29uc3QgUExBQ0VNRU5UID0gJ1BMQUNFTUVOVCdcbmV4cG9ydCBjb25zdCBERUxFVElPTiA9ICdERUxFVElPTidcbiIsImV4cG9ydCBjb25zdCBpc1Byb3BlcnR5ID0ga2V5ID0+IGtleSAhPT0gJ2NoaWxkcmVuJyAmJiAhaXNFdmVudChrZXkpXG5leHBvcnQgY29uc3QgaXNFdmVudCA9IGtleSA9PiBrZXkuc3RhcnRzV2l0aCgnb24nKVxuZXhwb3J0IGNvbnN0IGlzTmV3ID0gKHByZXYsIG5leHQpID0+IGtleSA9PiBwcmV2W2tleV0gIT09IG5leHRba2V5XVxuZXhwb3J0IGNvbnN0IGlzR29uZSA9IChwcmV2LCBuZXh0KSA9PiBrZXkgPT4gIShrZXkgaW4gbmV4dClcblxuZXhwb3J0IGNvbnN0IGZsYXQgPSBhcnIgPT4gKFxuICBhcnIucmVkdWNlKChwcmV2LCBuZXh0KSA9PiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkobmV4dCkpIHtcbiAgICAgIHJldHVybiBwcmV2LmNvbmNhdChmbGF0KG5leHQpKVxuICAgIH1cbiAgICByZXR1cm4gcHJldi5jb25jYXQoW25leHRdKVxuICB9LCBbXSlcbilcblxuZXhwb3J0IGNvbnN0IHRyaW0gPSBzID0+IHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvXltcXHNcXG5dK3xcXHMrJC9nLCAnJylcbn1cblxuY29uc3QgdHlwZSA9IG8gPT4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpXG5leHBvcnQgY29uc3QgaXNQcmltaXRpdmUgPSBvID0+IFsnbnVtYmVyJywgJ3N0cmluZycsICdib29sZWFuJ10uaW5kZXhPZih0eXBlKG8pKSAhPT0gLTFcbmV4cG9ydCBjb25zdCBpc051bGxPclVuZGVmaW5lZCA9IG8gPT4gWydudWxsJywgJ3VuZGVmaW5lZCddLmluZGV4T2YodHlwZShvKSkgIT09IC0xXG4iLCJpbXBvcnQgeyBURVhUX0VMRU1FTlQgfSBmcm9tICcuL2NvbnN0YW50cydcbmltcG9ydCB7IGZsYXQgfSBmcm9tICcuL3V0aWxzJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50ICh0eXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY2hpbGRyZW4gPSBmbGF0KGNoaWxkcmVuKVxuICByZXR1cm4ge1xuICAgIGlzRWxlbWVudDogdHJ1ZSxcbiAgICB0eXBlLFxuICAgIHByb3BzOiB7XG4gICAgICAuLi5wcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbi5tYXAoY2hpbGQgPT4ge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGNoaWxkID09PSAnc3RyaW5nJ1xuICAgICAgICAgID8gY3JlYXRlVGV4dEVsZW1lbnQoY2hpbGQpXG4gICAgICAgICAgOiBjaGlsZFxuICAgICAgfSlcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlVGV4dEVsZW1lbnQgKHRleHQpIHtcbiAgcmV0dXJuIHtcbiAgICBpc0VsZW1lbnQ6IHRydWUsXG4gICAgdHlwZTogVEVYVF9FTEVNRU5ULFxuICAgIHByb3BzOiB7XG4gICAgICBub2RlVmFsdWU6IHRleHQsXG4gICAgICBjaGlsZHJlbjogW11cbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IFRFWFRfRUxFTUVOVCB9IGZyb20gJy4vY29uc3RhbnRzJ1xuaW1wb3J0IHsgaXNQcm9wZXJ0eSwgaXNOZXcsIGlzR29uZSwgaXNFdmVudCB9IGZyb20gJy4vdXRpbHMnXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVET00gKHR5cGUpIHtcbiAgY29uc3QgJGRvbSA9IHR5cGUgPT09IFRFWFRfRUxFTUVOVFxuICAgID8gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpXG4gICAgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHR5cGUpXG5cbiAgcmV0dXJuICRkb21cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZG9tXG4gKiBAcGFyYW0ge09iamVjdH0gb2xkUHJvcHNcbiAqIEBwYXJhbSB7T2JqZWN0fSBuZXdQcm9wc1xuICovXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlRE9NIChkb20sIG9sZFByb3BzLCBuZXdQcm9wcykge1xuICBPYmplY3Qua2V5cyhvbGRQcm9wcylcbiAgICAuZmlsdGVyKGlzRXZlbnQpXG4gICAgLmZpbHRlcihrZXkgPT4gIShrZXkgaW4gbmV3UHJvcHMpIHx8IG9sZFByb3BzW2tleV0gIT09IG5ld1Byb3BzW2tleV0pXG4gICAgLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50ID0ga2V5LnRvTG93ZXJDYXNlKCkuc3Vic3RyaW5nKDIpXG4gICAgICBkb20ucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgb2xkUHJvcHNba2V5XSlcbiAgICB9KVxuXG4gIE9iamVjdC5rZXlzKG9sZFByb3BzKVxuICAgIC5maWx0ZXIoaXNQcm9wZXJ0eSlcbiAgICAuZmlsdGVyKGlzR29uZShvbGRQcm9wcywgbmV3UHJvcHMpKVxuICAgIC5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBkb21ba2V5XSA9ICcnXG4gICAgfSlcblxuICBPYmplY3Qua2V5cyhuZXdQcm9wcylcbiAgICAuZmlsdGVyKGlzRXZlbnQpXG4gICAgLmZpbHRlcihpc05ldyhvbGRQcm9wcywgbmV3UHJvcHMpKVxuICAgIC5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCBldmVudCA9IGtleS50b0xvd2VyQ2FzZSgpLnN1YnN0cmluZygyKVxuICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIG5ld1Byb3BzW2tleV0pXG4gICAgfSlcblxuICBPYmplY3Qua2V5cyhuZXdQcm9wcylcbiAgICAuZmlsdGVyKGlzUHJvcGVydHkpXG4gICAgLmZpbHRlcihpc05ldyhvbGRQcm9wcywgbmV3UHJvcHMpKVxuICAgIC5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBkb21ba2V5XSA9IG5ld1Byb3BzW2tleV1cbiAgICB9KVxufVxuIiwiaW1wb3J0IHsgY3JlYXRlRE9NLCB1cGRhdGVET00gfSBmcm9tICcuL2RvbSdcbmltcG9ydCB7IFVQREFURSwgUExBQ0VNRU5ULCBERUxFVElPTiB9IGZyb20gJy4vY29uc3RhbnRzJ1xuXG4vKipcbiAqIOaXtumXtOWIh+eJh1xuICog5bCG5q+P5LiqRWxlbWVudOWIh+WIhuS4uuS4gOS4quWwj+eahOW3peS9nOWNleWFg1xuICovXG5cbi8qKlxuICAqIEZpYmVyXG4gICoge1xuICAqICB0eXBlOiBzdHJpbmdcbiAgKiAgcHJvcHM6IHtcbiAgKiAgICBjaGlsZHJlbjogRWxlbWVudFtdXG4gICogIH1cbiAgKiAgZG9tOiBIVE1MRWxlbWVudFxuICAqICBwYXJlbnQ6IEZpYmVyXG4gICogIGNoaWxkOiBGaWJlclxuICAqICBzaWJsaW5nOiBGaWJlclxuICAqICBhbHRlcm5hdGU6IEZpYmVyXG4gICogIGVmZmVjdFRhZzogc3RyaW5nXG4gICogfVxuICAqL1xuXG5sZXQgdW5pdE9mV29yayA9IG51bGwgLy8g5pe26Ze05YiH54mH77ya5b2T5YmN5omA6KaB6L+b6KGM5bel5L2c55qERmliZXLljZXlhYNcbmxldCB3aXBSb290ID0gbnVsbCAvLyDkv53lrZhmaWJlciB0cmVl55qE5qC557uT54K577yMIHdvcmsgaW4gcHJvZ3Jlc3Mgcm9vdFxuY29uc3QgZGVsZXRpb25zID0gW11cbmxldCBjdXJyZW50Um9vdCA9IG51bGwgLy8g6K6w5b2V5b2T5YmN5bel5L2c5Yiw5ZOq5Liq6IqC54K5XG5cbmZ1bmN0aW9uIGNvbW1pdFJvb3QgKCkge1xuICBsZXQgZGVsZXRpb24gPSBudWxsXG4gIHdoaWxlICgoZGVsZXRpb24gPSBkZWxldGlvbnMuc2hpZnQoKSkpIHtcbiAgICBjb21taXRXb3JrKGRlbGV0aW9uKVxuICB9XG4gIGNvbW1pdFdvcmsod2lwUm9vdC5jaGlsZClcbiAgY3VycmVudFJvb3QgPSB3aXBSb290XG4gIHdpcFJvb3QgPSBudWxsXG59XG5cbi8qKlxuICog5pON5L2c6IqC54K577yM5pu05paw77yM5Yig6Zmk77yM5re75YqgXG4gKiBAcGFyYW0ge0ZpYmVyfSBmaWJlclxuICovXG5mdW5jdGlvbiBjb21taXRXb3JrIChmaWJlcikge1xuICBpZiAoIWZpYmVyKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyDlh73mlbDnu4Tku7bmsqHmnIlkb21cbiAgLy8g5Li65Ye95pWw57uE5Lu255qE5a2Q5YWD57Sg5b6q546v5p+l5om+5Yiw54i26IqC54K5XG4gIGxldCBmaWJlclBhcmVudERPTSA9IGZpYmVyLnBhcmVudFxuICBpZiAoIWZpYmVyUGFyZW50RE9NLmRvbSkge1xuICAgIGZpYmVyUGFyZW50RE9NID0gZmliZXJQYXJlbnRET00ucGFyZW50XG4gIH1cbiAgY29uc3QgcGFyZW50RE9NID0gZmliZXJQYXJlbnRET00uZG9tXG5cbiAgLy8gZnVuY3Rpb24gY29tcG9uZW50IGRvbid0IGhhdmUgZG9tXG4gIGlmIChmaWJlci5lZmZlY3RUYWcgPT09IFBMQUNFTUVOVCAmJiBmaWJlci5kb20pIHtcbiAgICBwYXJlbnRET00uYXBwZW5kQ2hpbGQoZmliZXIuZG9tKVxuICB9IGVsc2UgaWYgKGZpYmVyLmVmZmVjdFRhZyA9PT0gVVBEQVRFKSB7XG4gICAgdXBkYXRlRE9NKGZpYmVyLmRvbSwgZmliZXIuYWx0ZXJuYXRlLnByb3BzLCBmaWJlci5wcm9wcylcbiAgfSBlbHNlIGlmIChmaWJlci5lZmZlY3RUYWcgPT09IERFTEVUSU9OKSB7XG4gICAgY29tbWl0RGVsZXRpb24oZmliZXIsIHBhcmVudERPTSlcbiAgICByZXR1cm5cbiAgfVxuICBjb21taXRXb3JrKGZpYmVyLmNoaWxkKVxuICBjb21taXRXb3JrKGZpYmVyLnNpYmxpbmcpXG59XG5cbmZ1bmN0aW9uIGNvbW1pdERlbGV0aW9uIChmaWJlciwgZG9tUGFyZW50KSB7XG4gIGlmIChmaWJlci5kb20pIHtcbiAgICBkb21QYXJlbnQucmVtb3ZlQ2hpbGQoZmliZXIuZG9tKVxuICB9IGVsc2Uge1xuICAgIGNvbW1pdERlbGV0aW9uKGZpYmVyLmNoaWxkLCBkb21QYXJlbnQpXG4gIH1cbn1cblxuLyoqXG4gKiDmtY/op4jlmajnqbrpl7Lml7bmiafooYzlt6XkvZxcbiAqIEBwYXJhbSB7SWRsZURlYWRsaW5lfSBkZWFkbGluZVxuICovXG5mdW5jdGlvbiB3b3JrTG9vcCAoZGVhZGxpbmUpIHtcbiAgbGV0IHNob3VsZFBhdXNlID0gZmFsc2VcblxuICB3aGlsZSAodW5pdE9mV29yayAmJiAhc2hvdWxkUGF1c2UpIHtcbiAgICB1bml0T2ZXb3JrID0gcGVyZm9ybVVuaXRPZldvcmsodW5pdE9mV29yaylcbiAgICBzaG91bGRQYXVzZSA9IGRlYWRsaW5lLnRpbWVSZW1haW5pbmcoKSA8IDFcbiAgfVxuXG4gIC8vIOmBv+WFjea4suafk+mDqOWIhlVJXG4gIGlmICghdW5pdE9mV29yayAmJiB3aXBSb290KSB7XG4gICAgY29tbWl0Um9vdCgpXG4gIH1cblxuICB3aW5kb3cucmVxdWVzdElkbGVDYWxsYmFjayh3b3JrTG9vcClcbn1cblxud2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2sod29ya0xvb3ApXG5cbi8qKlxuICog5q+P5LiA5qyh5bel5L2c5aSE55CG5LiA5LiqRmliZXLlhYPntKBcbiAqIDEuIOa3u+WKoERPTVxuICogMi4g5p6E5bu6RmliZXLoioLngrlcbiAqIDMuIOi/lOWbnuS4i+S4gOS4qkZpYmVy6IqC54K5XG4gKiBAcGFyYW0ge0ZpYmVyfSBmaWJlclxuICovXG5mdW5jdGlvbiBwZXJmb3JtVW5pdE9mV29yayAoZmliZXIpIHtcbiAgY29uc3QgaXNGdW5jdGlvbkNvbXBvbmVudCA9IGZpYmVyLnR5cGUgaW5zdGFuY2VvZiBGdW5jdGlvblxuXG4gIGlmIChpc0Z1bmN0aW9uQ29tcG9uZW50KSB7XG4gICAgdXBkYXRlRnVuY3Rpb25Db21wb25lbnQoZmliZXIpXG4gIH0gZWxzZSB7XG4gICAgdXBkYXRlSG9zdENvbXBvbmVudChmaWJlcilcbiAgfVxuXG4gIGlmIChmaWJlci5jaGlsZCkge1xuICAgIHJldHVybiBmaWJlci5jaGlsZFxuICB9XG4gIGxldCBuZXh0RmliZXIgPSBmaWJlclxuICB3aGlsZSAobmV4dEZpYmVyKSB7XG4gICAgaWYgKG5leHRGaWJlci5zaWJsaW5nKSB7XG4gICAgICByZXR1cm4gbmV4dEZpYmVyLnNpYmxpbmdcbiAgICB9XG4gICAgbmV4dEZpYmVyID0gbmV4dEZpYmVyLnBhcmVudFxuICB9XG59XG5cbmxldCB3aXBGaWJlciA9IG51bGwgLy8g5b2T5YmN5L2/55So5Yiw55qE5Ye95pWw57uE5Lu2XG5sZXQgaG9va0luZGV4ID0gMCAvLyDlvZPliY3nu4Tku7bnmoTpkqnlrZDkuIvmoIdcbmZ1bmN0aW9uIHVwZGF0ZUZ1bmN0aW9uQ29tcG9uZW50IChmaWJlcikge1xuICB3aXBGaWJlciA9IGZpYmVyXG4gIGhvb2tJbmRleCA9IDBcbiAgd2lwRmliZXIuaG9va3MgPSBbXVxuICBjb25zdCBjaGlsZHJlbiA9IFtmaWJlci50eXBlKGZpYmVyLnByb3BzKV1cbiAgcmVjb25jaWxlQ2hpbGRyZW4oZmliZXIsIGNoaWxkcmVuKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXNlU3RhdGUgKGluaXRpYWwpIHtcbiAgY29uc3Qgb2xkSG9vayA9XG4gICAgd2lwRmliZXIuYWx0ZXJuYXRlICYmXG4gICAgd2lwRmliZXIuYWx0ZXJuYXRlLmhvb2tzICYmXG4gICAgd2lwRmliZXIuYWx0ZXJuYXRlLmhvb2tzW2hvb2tJbmRleF1cblxuICBjb25zdCBob29rID0ge1xuICAgIHN0YXRlOiBvbGRIb29rID8gb2xkSG9vay5zdGF0ZSA6IGluaXRpYWwsXG4gICAgcXVldWU6IFtdXG4gIH1cblxuICAvLyDlkIjlubbmiafooYzlpJrkuKogc2V0U3RhdGVcbiAgY29uc3QgYWN0aW9ucyA9IG9sZEhvb2sgPyBvbGRIb29rLnF1ZXVlIDogW11cbiAgYWN0aW9ucy5mb3JFYWNoKGFjdGlvbiA9PiB7XG4gICAgaG9vay5zdGF0ZSA9IGFjdGlvbihob29rLnN0YXRlKVxuICB9KVxuXG4gIGNvbnN0IHNldFN0YXRlID0gYWN0aW9uID0+IHtcbiAgICBob29rLnF1ZXVlLnB1c2goYWN0aW9uKVxuICAgIC8vIOabtOaWsFxuICAgIHdpcFJvb3QgPSB7XG4gICAgICBkb206IGN1cnJlbnRSb290LmRvbSxcbiAgICAgIHByb3BzOiBjdXJyZW50Um9vdC5wcm9wcyxcbiAgICAgIGFsdGVybmF0ZTogY3VycmVudFJvb3RcbiAgICB9XG4gICAgdW5pdE9mV29yayA9IHdpcFJvb3RcbiAgfVxuXG4gIHdpcEZpYmVyLmhvb2tzLnB1c2goaG9vaylcbiAgaG9va0luZGV4KytcbiAgcmV0dXJuIFtob29rLnN0YXRlLCBzZXRTdGF0ZV1cbn1cblxuZnVuY3Rpb24gdXBkYXRlSG9zdENvbXBvbmVudCAoZmliZXIpIHtcbiAgY29uc3QgeyB0eXBlLCBkb20sIHByb3BzIH0gPSBmaWJlclxuICBpZiAoIWRvbSkge1xuICAgIGZpYmVyLmRvbSA9IGNyZWF0ZURPTSh0eXBlKVxuICAgIHVwZGF0ZURPTShmaWJlci5kb20sIHt9LCBwcm9wcylcbiAgfVxuICByZWNvbmNpbGVDaGlsZHJlbihmaWJlciwgcHJvcHMuY2hpbGRyZW4pXG59XG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7RmliZXJ9IHdpcEZpYmVyXG4gKiBAcGFyYW0ge0VsZW1lbnRbXX0gZWxlbWVudHNcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlY29uY2lsZUNoaWxkcmVuICh3aXBGaWJlciwgZWxlbWVudHMpIHtcbiAgbGV0IGluZGV4ID0gMFxuICBsZXQgcHJldlNpYmxpbmcgPSBudWxsXG4gIGxldCBvbGRGaWJlciA9IHdpcEZpYmVyLmFsdGVybmF0ZSAmJiB3aXBGaWJlci5hbHRlcm5hdGUuY2hpbGRcblxuICB3aGlsZSAoaW5kZXggPCBlbGVtZW50cy5sZW5ndGggfHwgb2xkRmliZXIgIT0gbnVsbCkge1xuICAgIGNvbnN0IGVsZW1lbnQgPSBlbGVtZW50c1tpbmRleF1cbiAgICBjb25zdCBpc1NhbWVUeXBlID0gb2xkRmliZXIgJiYgZWxlbWVudCAmJiBvbGRGaWJlci50eXBlID09PSBlbGVtZW50LnR5cGVcbiAgICBsZXQgbmV3RmliZXIgPSBudWxsXG5cbiAgICBpZiAoaXNTYW1lVHlwZSkge1xuICAgICAgbmV3RmliZXIgPSB7XG4gICAgICAgIHR5cGU6IG9sZEZpYmVyLnR5cGUsXG4gICAgICAgIHByb3BzOiBlbGVtZW50LnByb3BzLFxuICAgICAgICBkb206IG9sZEZpYmVyLmRvbSwgLy8g5pu05paw5ZCM5LiA5LiqRE9NXG4gICAgICAgIHBhcmVudDogd2lwRmliZXIsXG4gICAgICAgIGVmZmVjdFRhZzogVVBEQVRFLFxuICAgICAgICBhbHRlcm5hdGU6IG9sZEZpYmVyXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChlbGVtZW50ICYmICFpc1NhbWVUeXBlKSB7XG4gICAgICBuZXdGaWJlciA9IHtcbiAgICAgICAgdHlwZTogZWxlbWVudC50eXBlLFxuICAgICAgICBwcm9wczogZWxlbWVudC5wcm9wcyxcbiAgICAgICAgZG9tOiBudWxsLFxuICAgICAgICBwYXJlbnQ6IHdpcEZpYmVyLFxuICAgICAgICBlZmZlY3RUYWc6IFBMQUNFTUVOVCxcbiAgICAgICAgYWx0ZXJuYXRlOiBudWxsXG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChvbGRGaWJlciAmJiAhaXNTYW1lVHlwZSkge1xuICAgICAgb2xkRmliZXIuZWZmZWN0VGFnID0gREVMRVRJT05cbiAgICAgIGRlbGV0aW9ucy5wdXNoKG9sZEZpYmVyKVxuICAgIH1cblxuICAgIGlmIChvbGRGaWJlcikge1xuICAgICAgb2xkRmliZXIgPSBvbGRGaWJlci5zaWJsaW5nXG4gICAgfVxuXG4gICAgaWYgKGluZGV4ID09PSAwKSB7XG4gICAgICB3aXBGaWJlci5jaGlsZCA9IG5ld0ZpYmVyXG4gICAgfSBlbHNlIGlmIChwcmV2U2libGluZyAhPSBudWxsKSB7XG4gICAgICBwcmV2U2libGluZy5zaWJsaW5nID0gbmV3RmliZXJcbiAgICB9XG5cbiAgICBwcmV2U2libGluZyA9IG5ld0ZpYmVyXG4gICAgaW5kZXgrK1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXIgKGVsZW1lbnQsIGNvbnRhaW5lcikge1xuICBjb25zdCBmaWJlclJvb3QgPSB7XG4gICAgZG9tOiBjb250YWluZXIsXG4gICAgcHJvcHM6IHtcbiAgICAgIGNoaWxkcmVuOiBbZWxlbWVudF1cbiAgICB9LFxuICAgIGFsdGVybmF0ZTogbnVsbFxuICB9XG4gIHVuaXRPZldvcmsgPSBmaWJlclJvb3RcbiAgd2lwUm9vdCA9IGZpYmVyUm9vdFxufVxuIiwiaW1wb3J0IHsgdHJpbSwgaXNQcmltaXRpdmUsIGlzTnVsbE9yVW5kZWZpbmVkLCBmbGF0IH0gZnJvbSAnLi4vdXRpbHMnXG5pbXBvcnQgY3JlYXRlRWxlbWVudCBmcm9tICcuLi9jcmVhdGVFbGVtZW50J1xuXG5jb25zdCByZWdUYWdTdGFydCA9IC9ePChcXHcrKVxccyooW14+XSopXFxzKj4vXG5jb25zdCByZWdUYWdDbG9zZSA9IC9ePFxcLyhcXHcrKVxccyo+L1xuY29uc3QgcmVnVGFnVmFsdWUgPSAvXltePF0qL1xuY29uc3QgcmVnVGFnQXR0ciA9IC8oW1xcdy1dKyk9XCIoW15cIl0rKVwiL2dcbmNvbnN0IFRBR19TVEFSVCA9ICdUQUdfU1RBUlQnXG5jb25zdCBUQUdfQ0xPU0UgPSAnVEFHX0NMT1NFJ1xuY29uc3QgVEFHX1ZBTFVFID0gJ1RBR19WQUxVRSdcbmNvbnN0IFRBR19BVFRSX05BTUUgPSAnVEFHX0FUVFJfTkFNRSdcbmNvbnN0IFRBR19BVFRSX1ZBTFVFID0gJ1RBR19BVFRSX1ZBTFVFJ1xuY29uc3QgaXNPYmplY3RWYWx1ZSA9IGtleSA9PiAvUHJlc2V0T2JqZWN0XFxkKy8udGVzdChrZXkpXG5jb25zdCBnZXRPYmplY3RWYWx1ZSA9IChvYmplY3RzLCBrZXkpID0+IHtcbiAgY29uc3QgcmVnRXhwID0gL1ByZXNldE9iamVjdFxcZCsvXG4gIHJldHVybiBvYmplY3RzW3JlZ0V4cC5leGVjKGtleSlbMF1dXG59XG5sZXQgZ2xvYmFsT2JqZWN0cyA9IG51bGxcblxuY29uc3QgcGFyc2VUb2tlbiA9IHRlbXBsYXRlID0+IHtcbiAgbGV0IHR5cGUgPSAnJ1xuICBsZXQgbWF0Y2hlcyA9IG51bGxcbiAgbGV0IHZhbHVlID0gbnVsbFxuICBsZXQgYXR0cnMgPSAnJ1xuXG4gIGlmICgobWF0Y2hlcyA9IHRlbXBsYXRlLm1hdGNoKHJlZ1RhZ1N0YXJ0KSkpIHtcbiAgICB0eXBlID0gVEFHX1NUQVJUXG4gICAgdmFsdWUgPSBtYXRjaGVzWzFdXG4gICAgYXR0cnMgPSBtYXRjaGVzWzJdXG4gIH0gZWxzZSBpZiAoKG1hdGNoZXMgPSB0ZW1wbGF0ZS5tYXRjaChyZWdUYWdDbG9zZSkpKSB7XG4gICAgdHlwZSA9IFRBR19DTE9TRVxuICAgIHZhbHVlID0gbWF0Y2hlc1sxXVxuICB9IGVsc2UgaWYgKChtYXRjaGVzID0gdGVtcGxhdGUubWF0Y2gocmVnVGFnVmFsdWUpKSkge1xuICAgIHR5cGUgPSBUQUdfVkFMVUVcbiAgICB2YWx1ZSA9IG1hdGNoZXNbMF1cbiAgfSBlbHNlIHtcbiAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCdsZXhpY2FsIGVycm9yJylcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgdHlwZSxcbiAgICB2YWx1ZSxcbiAgICBzdWJJbmRleDogbWF0Y2hlcy5pbmRleCArIG1hdGNoZXNbMF0ubGVuZ3RoLFxuICAgIGF0dHJzXG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2VBdHRyIChhdHRyKSB7XG4gIGxldCBtID0gbnVsbFxuICBjb25zdCBhdHRycyA9IFtdXG5cbiAgd2hpbGUgKChtID0gcmVnVGFnQXR0ci5leGVjKGF0dHIpKSkge1xuICAgIGF0dHJzLnB1c2goe1xuICAgICAgdHlwZTogVEFHX0FUVFJfTkFNRSxcbiAgICAgIHZhbHVlOiBtWzFdXG4gICAgfSlcbiAgICBhdHRycy5wdXNoKHtcbiAgICAgIHR5cGU6IFRBR19BVFRSX1ZBTFVFLFxuICAgICAgdmFsdWU6IG1bMl1cbiAgICB9KVxuICB9XG4gIHJldHVybiBhdHRyc1xufVxuXG5jb25zdCBwYXJzZUxleGljYWwgPSB0ZW1wbGF0ZSA9PiB7XG4gIGxldCB0b2tlbnMgPSBbXVxuICBsZXQgdGVtcCA9IHRyaW0odGVtcGxhdGUpXG4gIHdoaWxlICh0ZW1wLmxlbmd0aCkge1xuICAgIHRlbXAgPSB0cmltKHRlbXApXG4gICAgY29uc3QgdG9rZW4gPSBwYXJzZVRva2VuKHRlbXApXG4gICAgdGVtcCA9IHRlbXAuc3Vic3RyaW5nKHRva2VuLnN1YkluZGV4KVxuICAgIHRva2Vucy5wdXNoKHRva2VuKVxuICAgIGlmICh0b2tlbi50eXBlID09PSBUQUdfU1RBUlQpIHtcbiAgICAgIHRva2VucyA9IHRva2Vucy5jb25jYXQocGFyc2VBdHRyKHRva2VuLmF0dHJzKSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRva2Vuc1xufVxuXG5jb25zdCBwYXJzZVN5bnRheCA9IHRva2VucyA9PiB7XG4gIGxldCBpbmRleCA9IDBcbiAgbGV0IG5leHRUb2tlbiA9IHRva2Vuc1tpbmRleF1cbiAgbGV0IGN1cnJlbnQgPSBudWxsXG4gIGxldCBhdHRyTmFtZSA9ICcnXG5cbiAgY29uc3QgdHJlZSA9IGN1cnJlbnQgPSB7XG4gICAgdHlwZTogJ3Jvb3QnLFxuICAgIGNoaWxkcmVuOiBbXVxuICB9XG5cbiAgY29uc3QgZ29OZXh0ID0gKCkgPT4ge1xuICAgIHJldHVybiB0b2tlbnNbKytpbmRleF1cbiAgfVxuXG4gIHdoaWxlIChuZXh0VG9rZW4pIHtcbiAgICBsZXQgdmFsdWUgPSBuZXh0VG9rZW4udmFsdWVcbiAgICBpZiAoaXNPYmplY3RWYWx1ZSh2YWx1ZSkpIHtcbiAgICAgIHZhbHVlID0gZ2V0T2JqZWN0VmFsdWUoZ2xvYmFsT2JqZWN0cywgdmFsdWUpXG4gICAgfVxuICAgIGlmIChuZXh0VG9rZW4udHlwZSA9PT0gVEFHX1NUQVJUKSB7XG4gICAgICBjb25zdCB0ZW1wUm9vdCA9IHtcbiAgICAgICAgdHlwZTogdmFsdWUsXG4gICAgICAgIGNoaWxkcmVuOiBbXSxcbiAgICAgICAgcHJvcHM6IHt9LFxuICAgICAgICBwYXJlbnQ6IGN1cnJlbnRcbiAgICAgIH1cbiAgICAgIGN1cnJlbnQuY2hpbGRyZW4ucHVzaCh0ZW1wUm9vdClcbiAgICAgIGN1cnJlbnQgPSB0ZW1wUm9vdFxuICAgIH0gZWxzZSBpZiAobmV4dFRva2VuLnR5cGUgPT09IFRBR19DTE9TRSkge1xuICAgICAgY29uc3QgdGVtcFJvb3QgPSBjdXJyZW50XG4gICAgICBjdXJyZW50ID0gdGVtcFJvb3QucGFyZW50XG4gICAgICBkZWxldGUgdGVtcFJvb3QucGFyZW50XG4gICAgfSBlbHNlIGlmIChuZXh0VG9rZW4udHlwZSA9PT0gVEFHX0FUVFJfTkFNRSkge1xuICAgICAgYXR0ck5hbWUgPSBuZXh0VG9rZW4udmFsdWVcbiAgICB9IGVsc2UgaWYgKG5leHRUb2tlbi50eXBlID09PSBUQUdfQVRUUl9WQUxVRSkge1xuICAgICAgY3VycmVudC5wcm9wc1thdHRyTmFtZV0gPSB2YWx1ZVxuICAgIH0gZWxzZSBpZiAobmV4dFRva2VuLnR5cGUgPT09IFRBR19WQUxVRSkge1xuICAgICAgY3VycmVudC5jaGlsZHJlbi5wdXNoKHZhbHVlKVxuICAgIH1cblxuICAgIG5leHRUb2tlbiA9IGdvTmV4dCgpXG4gIH1cblxuICByZXR1cm4gdHJlZS5jaGlsZHJlblswXVxufVxuXG5jb25zdCBpc0V4aXN0SW4gPSAob2JqZWN0cywgdmFsdWUpID0+IHtcbiAgY29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKG9iamVjdHMpXG4gIGZvciAobGV0IGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7IGkrKykge1xuICAgIGNvbnN0IGsgPSBrZXlzW2ldXG4gICAgaWYgKG9iamVjdHNba10gPT09IHZhbHVlKSB7XG4gICAgICByZXR1cm4ga1xuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbFxufVxuXG5jb25zdCBwcmVzZXQgPSAoc3RhdGljcywgLi4uZW50aXRpZXMpID0+IHtcbiAgY29uc3Qgb2JqZWN0cyA9IHt9XG4gIGxldCB0ZW1wbGF0ZSA9ICcnXG4gIGxldCBjb3VudCA9IDBcbiAgbGV0IGkgPSAwXG4gIGZvciAoOyBpIDwgZW50aXRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICBsZXQgZSA9IGVudGl0aWVzW2ldXG4gICAgaWYgKGlzTnVsbE9yVW5kZWZpbmVkKGUpKSB7XG4gICAgICBlID0gJydcbiAgICB9XG5cbiAgICBpZiAoIWlzUHJpbWl0aXZlKGUpKSB7XG4gICAgICBjb25zdCBleGlzdGtleSA9IGlzRXhpc3RJbihvYmplY3RzLCBlKVxuICAgICAgaWYgKGV4aXN0a2V5KSB7XG4gICAgICAgIGUgPSBleGlzdGtleVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qga2V5ID0gYFByZXNldE9iamVjdCR7Y291bnQrK31gXG4gICAgICAgIG9iamVjdHNba2V5XSA9IGVcbiAgICAgICAgZSA9IGtleVxuICAgICAgfVxuICAgIH1cbiAgICB0ZW1wbGF0ZSArPSAoc3RhdGljc1tpXSArIGUpXG4gIH1cbiAgdGVtcGxhdGUgKz0gc3RhdGljc1tpXVxuICBnbG9iYWxPYmplY3RzID0gb2JqZWN0c1xuICByZXR1cm4gdGVtcGxhdGVcbn1cblxuY29uc3QgY29udmVydFRvRWxlbWVudHMgPSB0cmVlID0+IHtcbiAgaWYgKHRyZWUuaXNFbGVtZW50KSB7XG4gICAgcmV0dXJuIHRyZWVcbiAgfVxuICBjb25zdCBjaGlsZHJlbiA9IHRyZWUuY2hpbGRyZW4gPyBmbGF0KHRyZWUuY2hpbGRyZW4pLm1hcChjb252ZXJ0VG9FbGVtZW50cykgOiBbXVxuICByZXR1cm4gdHlwZW9mIHRyZWUgPT09ICdvYmplY3QnID8gY3JlYXRlRWxlbWVudCh0cmVlLnR5cGUsIHRyZWUucHJvcHMsIC4uLmNoaWxkcmVuKSA6IHRyZWVcbn1cblxuZXhwb3J0IGNvbnN0IHQgPSAoc3RhdGljcywgLi4uZW50aXRpZXMpID0+IHtcbiAgY29uc3QgdGVtcGxhdGUgPSBwcmVzZXQoc3RhdGljcywgLi4uZW50aXRpZXMpXG4gIGNvbnN0IHRva2VucyA9IHBhcnNlTGV4aWNhbCh0ZW1wbGF0ZSlcbiAgY29uc3Qgc3ludGF4ID0gcGFyc2VTeW50YXgodG9rZW5zKVxuICByZXR1cm4gY29udmVydFRvRWxlbWVudHMoc3ludGF4KVxufVxuIiwiaW1wb3J0IGNyZWF0ZUVsZW1lbnQgZnJvbSAnLi9jcmVhdGVFbGVtZW50J1xuaW1wb3J0IHsgdXNlU3RhdGUsIHJlbmRlciB9IGZyb20gJy4vcmVjb25jaWxlJ1xuaW1wb3J0IHsgdCB9IGZyb20gJy4vdGVtcGxhdGUvdCdcblxuZXhwb3J0IGRlZmF1bHQge1xuICBjcmVhdGVFbGVtZW50LFxuICByZW5kZXIsXG4gIHVzZVN0YXRlLFxuICB0XG59XG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7RUFBTyxNQUFNLFlBQVksR0FBRyxlQUFjO0FBQzFDLEVBQU8sTUFBTSxNQUFNLEdBQUcsU0FBUTtBQUM5QixFQUFPLE1BQU0sU0FBUyxHQUFHLFlBQVc7QUFDcEMsRUFBTyxNQUFNLFFBQVEsR0FBRyxVQUFVOztFQ0gzQixNQUFNLFVBQVUsR0FBRyxHQUFHLElBQUksR0FBRyxLQUFLLFVBQVUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUM7QUFDcEUsRUFBTyxNQUFNLE9BQU8sR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUM7QUFDbEQsRUFBTyxNQUFNLEtBQUssR0FBRyxDQUFDLElBQUksRUFBRSxJQUFJLEtBQUssR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFH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
