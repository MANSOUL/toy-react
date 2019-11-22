
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
      shouldPause = deadline.timeRemaining() < 20;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYnVuZGxlLmpzIiwic291cmNlcyI6WyIuLi9zcmMvY29uc3RhbnRzLmpzIiwiLi4vc3JjL3V0aWxzLmpzIiwiLi4vc3JjL2NyZWF0ZUVsZW1lbnQuanMiLCIuLi9zcmMvZG9tLmpzIiwiLi4vc3JjL3JlY29uY2lsZS5qcyIsIi4uL3NyYy90ZW1wbGF0ZS90LmpzIiwiLi4vc3JjL2luZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBjb25zdCBURVhUX0VMRU1FTlQgPSAnVEVYVF9FTEVNRU5UJ1xuZXhwb3J0IGNvbnN0IFVQREFURSA9ICdVUERBVEUnXG5leHBvcnQgY29uc3QgUExBQ0VNRU5UID0gJ1BMQUNFTUVOVCdcbmV4cG9ydCBjb25zdCBERUxFVElPTiA9ICdERUxFVElPTidcbiIsImV4cG9ydCBjb25zdCBpc1Byb3BlcnR5ID0ga2V5ID0+IGtleSAhPT0gJ2NoaWxkcmVuJyAmJiAhaXNFdmVudChrZXkpXG5leHBvcnQgY29uc3QgaXNFdmVudCA9IGtleSA9PiBrZXkuc3RhcnRzV2l0aCgnb24nKVxuZXhwb3J0IGNvbnN0IGlzTmV3ID0gKHByZXYsIG5leHQpID0+IGtleSA9PiBwcmV2W2tleV0gIT09IG5leHRba2V5XVxuZXhwb3J0IGNvbnN0IGlzR29uZSA9IChwcmV2LCBuZXh0KSA9PiBrZXkgPT4gIShrZXkgaW4gbmV4dClcblxuZXhwb3J0IGNvbnN0IGZsYXQgPSBhcnIgPT4gKFxuICBhcnIucmVkdWNlKChwcmV2LCBuZXh0KSA9PiB7XG4gICAgaWYgKEFycmF5LmlzQXJyYXkobmV4dCkpIHtcbiAgICAgIHJldHVybiBwcmV2LmNvbmNhdChmbGF0KG5leHQpKVxuICAgIH1cbiAgICByZXR1cm4gcHJldi5jb25jYXQoW25leHRdKVxuICB9LCBbXSlcbilcblxuZXhwb3J0IGNvbnN0IHRyaW0gPSBzID0+IHtcbiAgcmV0dXJuIHMucmVwbGFjZSgvXltcXHNcXG5dK3xcXHMrJC9nLCAnJylcbn1cblxuY29uc3QgdHlwZSA9IG8gPT4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG8pLnNsaWNlKDgsIC0xKS50b0xvd2VyQ2FzZSgpXG5leHBvcnQgY29uc3QgaXNQcmltaXRpdmUgPSBvID0+IFsnbnVtYmVyJywgJ3N0cmluZycsICdib29sZWFuJ10uaW5kZXhPZih0eXBlKG8pKSAhPT0gLTFcbmV4cG9ydCBjb25zdCBpc051bGxPclVuZGVmaW5lZCA9IG8gPT4gWydudWxsJywgJ3VuZGVmaW5lZCddLmluZGV4T2YodHlwZShvKSkgIT09IC0xXG4iLCJpbXBvcnQgeyBURVhUX0VMRU1FTlQgfSBmcm9tICcuL2NvbnN0YW50cydcbmltcG9ydCB7IGZsYXQgfSBmcm9tICcuL3V0aWxzJ1xuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBjcmVhdGVFbGVtZW50ICh0eXBlLCBwcm9wcywgLi4uY2hpbGRyZW4pIHtcbiAgY2hpbGRyZW4gPSBmbGF0KGNoaWxkcmVuKVxuICByZXR1cm4ge1xuICAgIGlzRWxlbWVudDogdHJ1ZSxcbiAgICB0eXBlLFxuICAgIHByb3BzOiB7XG4gICAgICAuLi5wcm9wcyxcbiAgICAgIGNoaWxkcmVuOiBjaGlsZHJlbi5tYXAoY2hpbGQgPT4ge1xuICAgICAgICByZXR1cm4gdHlwZW9mIGNoaWxkID09PSAnc3RyaW5nJ1xuICAgICAgICAgID8gY3JlYXRlVGV4dEVsZW1lbnQoY2hpbGQpXG4gICAgICAgICAgOiBjaGlsZFxuICAgICAgfSlcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlVGV4dEVsZW1lbnQgKHRleHQpIHtcbiAgcmV0dXJuIHtcbiAgICBpc0VsZW1lbnQ6IHRydWUsXG4gICAgdHlwZTogVEVYVF9FTEVNRU5ULFxuICAgIHByb3BzOiB7XG4gICAgICBub2RlVmFsdWU6IHRleHQsXG4gICAgICBjaGlsZHJlbjogW11cbiAgICB9XG4gIH1cbn1cbiIsImltcG9ydCB7IFRFWFRfRUxFTUVOVCB9IGZyb20gJy4vY29uc3RhbnRzJ1xuaW1wb3J0IHsgaXNQcm9wZXJ0eSwgaXNOZXcsIGlzR29uZSwgaXNFdmVudCB9IGZyb20gJy4vdXRpbHMnXG5cbi8qKlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVET00gKHR5cGUpIHtcbiAgY29uc3QgJGRvbSA9IHR5cGUgPT09IFRFWFRfRUxFTUVOVFxuICAgID8gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJycpXG4gICAgOiBkb2N1bWVudC5jcmVhdGVFbGVtZW50KHR5cGUpXG5cbiAgcmV0dXJuICRkb21cbn1cblxuLyoqXG4gKlxuICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZG9tXG4gKiBAcGFyYW0ge09iamVjdH0gb2xkUHJvcHNcbiAqIEBwYXJhbSB7T2JqZWN0fSBuZXdQcm9wc1xuICovXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlRE9NIChkb20sIG9sZFByb3BzLCBuZXdQcm9wcykge1xuICBPYmplY3Qua2V5cyhvbGRQcm9wcylcbiAgICAuZmlsdGVyKGlzRXZlbnQpXG4gICAgLmZpbHRlcihrZXkgPT4gIShrZXkgaW4gbmV3UHJvcHMpIHx8IG9sZFByb3BzW2tleV0gIT09IG5ld1Byb3BzW2tleV0pXG4gICAgLmZvckVhY2goa2V5ID0+IHtcbiAgICAgIGNvbnN0IGV2ZW50ID0ga2V5LnRvTG93ZXJDYXNlKCkuc3Vic3RyaW5nKDIpXG4gICAgICBkb20ucmVtb3ZlRXZlbnRMaXN0ZW5lcihldmVudCwgb2xkUHJvcHNba2V5XSlcbiAgICB9KVxuXG4gIE9iamVjdC5rZXlzKG9sZFByb3BzKVxuICAgIC5maWx0ZXIoaXNQcm9wZXJ0eSlcbiAgICAuZmlsdGVyKGlzR29uZShvbGRQcm9wcywgbmV3UHJvcHMpKVxuICAgIC5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBkb21ba2V5XSA9ICcnXG4gICAgfSlcblxuICBPYmplY3Qua2V5cyhuZXdQcm9wcylcbiAgICAuZmlsdGVyKGlzRXZlbnQpXG4gICAgLmZpbHRlcihpc05ldyhvbGRQcm9wcywgbmV3UHJvcHMpKVxuICAgIC5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBjb25zdCBldmVudCA9IGtleS50b0xvd2VyQ2FzZSgpLnN1YnN0cmluZygyKVxuICAgICAgZG9tLmFkZEV2ZW50TGlzdGVuZXIoZXZlbnQsIG5ld1Byb3BzW2tleV0pXG4gICAgfSlcblxuICBPYmplY3Qua2V5cyhuZXdQcm9wcylcbiAgICAuZmlsdGVyKGlzUHJvcGVydHkpXG4gICAgLmZpbHRlcihpc05ldyhvbGRQcm9wcywgbmV3UHJvcHMpKVxuICAgIC5mb3JFYWNoKGtleSA9PiB7XG4gICAgICBkb21ba2V5XSA9IG5ld1Byb3BzW2tleV1cbiAgICB9KVxufVxuIiwiaW1wb3J0IHsgY3JlYXRlRE9NLCB1cGRhdGVET00gfSBmcm9tICcuL2RvbSdcbmltcG9ydCB7IFVQREFURSwgUExBQ0VNRU5ULCBERUxFVElPTiB9IGZyb20gJy4vY29uc3RhbnRzJ1xuXG4vKipcbiAqIOaXtumXtOWIh+eJh1xuICog5bCG5q+P5LiqRWxlbWVudOWIh+WIhuS4uuS4gOS4quWwj+eahOW3peS9nOWNleWFg1xuICovXG5cbi8qKlxuICAqIEZpYmVyXG4gICoge1xuICAqICB0eXBlOiBzdHJpbmdcbiAgKiAgcHJvcHM6IHtcbiAgKiAgICBjaGlsZHJlbjogRWxlbWVudFtdXG4gICogIH1cbiAgKiAgZG9tOiBIVE1MRWxlbWVudFxuICAqICBwYXJlbnQ6IEZpYmVyXG4gICogIGNoaWxkOiBGaWJlclxuICAqICBzaWJsaW5nOiBGaWJlclxuICAqICBhbHRlcm5hdGU6IEZpYmVyXG4gICogIGVmZmVjdFRhZzogc3RyaW5nXG4gICogfVxuICAqL1xuXG5sZXQgdW5pdE9mV29yayA9IG51bGwgLy8g5pe26Ze05YiH54mH77ya5b2T5YmN5omA6KaB6L+b6KGM5bel5L2c55qERmliZXLljZXlhYNcbmxldCB3aXBSb290ID0gbnVsbCAvLyDkv53lrZhmaWJlciB0cmVl55qE5qC557uT54K577yMIHdvcmsgaW4gcHJvZ3Jlc3Mgcm9vdFxuY29uc3QgZGVsZXRpb25zID0gW11cbmxldCBjdXJyZW50Um9vdCA9IG51bGwgLy8g6K6w5b2V5b2T5YmN5bel5L2c5Yiw5ZOq5Liq6IqC54K5XG5cbmZ1bmN0aW9uIGNvbW1pdFJvb3QgKCkge1xuICBsZXQgZGVsZXRpb24gPSBudWxsXG4gIHdoaWxlICgoZGVsZXRpb24gPSBkZWxldGlvbnMuc2hpZnQoKSkpIHtcbiAgICBjb21taXRXb3JrKGRlbGV0aW9uKVxuICB9XG4gIGNvbW1pdFdvcmsod2lwUm9vdC5jaGlsZClcbiAgY3VycmVudFJvb3QgPSB3aXBSb290XG4gIHdpcFJvb3QgPSBudWxsXG59XG5cbi8qKlxuICog5pON5L2c6IqC54K577yM5pu05paw77yM5Yig6Zmk77yM5re75YqgXG4gKiBAcGFyYW0ge0ZpYmVyfSBmaWJlclxuICovXG5mdW5jdGlvbiBjb21taXRXb3JrIChmaWJlcikge1xuICBpZiAoIWZpYmVyKSB7XG4gICAgcmV0dXJuXG4gIH1cblxuICAvLyDlh73mlbDnu4Tku7bmsqHmnIlkb21cbiAgLy8g5Li65Ye95pWw57uE5Lu255qE5a2Q5YWD57Sg5b6q546v5p+l5om+5Yiw54i26IqC54K5XG4gIGxldCBmaWJlclBhcmVudERPTSA9IGZpYmVyLnBhcmVudFxuICBpZiAoIWZpYmVyUGFyZW50RE9NLmRvbSkge1xuICAgIGZpYmVyUGFyZW50RE9NID0gZmliZXJQYXJlbnRET00ucGFyZW50XG4gIH1cbiAgY29uc3QgcGFyZW50RE9NID0gZmliZXJQYXJlbnRET00uZG9tXG5cbiAgLy8gZnVuY3Rpb24gY29tcG9uZW50IGRvbid0IGhhdmUgZG9tXG4gIGlmIChmaWJlci5lZmZlY3RUYWcgPT09IFBMQUNFTUVOVCAmJiBmaWJlci5kb20pIHtcbiAgICBwYXJlbnRET00uYXBwZW5kQ2hpbGQoZmliZXIuZG9tKVxuICB9IGVsc2UgaWYgKGZpYmVyLmVmZmVjdFRhZyA9PT0gVVBEQVRFKSB7XG4gICAgdXBkYXRlRE9NKGZpYmVyLmRvbSwgZmliZXIuYWx0ZXJuYXRlLnByb3BzLCBmaWJlci5wcm9wcylcbiAgfSBlbHNlIGlmIChmaWJlci5lZmZlY3RUYWcgPT09IERFTEVUSU9OKSB7XG4gICAgY29tbWl0RGVsZXRpb24oZmliZXIsIHBhcmVudERPTSlcbiAgICByZXR1cm5cbiAgfVxuICBjb21taXRXb3JrKGZpYmVyLmNoaWxkKVxuICBjb21taXRXb3JrKGZpYmVyLnNpYmxpbmcpXG59XG5cbmZ1bmN0aW9uIGNvbW1pdERlbGV0aW9uIChmaWJlciwgZG9tUGFyZW50KSB7XG4gIGlmIChmaWJlci5kb20pIHtcbiAgICBkb21QYXJlbnQucmVtb3ZlQ2hpbGQoZmliZXIuZG9tKVxuICB9IGVsc2Uge1xuICAgIGNvbW1pdERlbGV0aW9uKGZpYmVyLmNoaWxkLCBkb21QYXJlbnQpXG4gIH1cbn1cblxuLyoqXG4gKiDmtY/op4jlmajnqbrpl7Lml7bmiafooYzlt6XkvZxcbiAqIEBwYXJhbSB7SWRsZURlYWRsaW5lfSBkZWFkbGluZVxuICovXG5mdW5jdGlvbiB3b3JrTG9vcCAoZGVhZGxpbmUpIHtcbiAgbGV0IHNob3VsZFBhdXNlID0gZmFsc2VcblxuICB3aGlsZSAodW5pdE9mV29yayAmJiAhc2hvdWxkUGF1c2UpIHtcbiAgICB1bml0T2ZXb3JrID0gcGVyZm9ybVVuaXRPZldvcmsodW5pdE9mV29yaylcbiAgICBzaG91bGRQYXVzZSA9IGRlYWRsaW5lLnRpbWVSZW1haW5pbmcoKSA8IDIwXG4gIH1cblxuICAvLyDpgb/lhY3muLLmn5Ppg6jliIZVSVxuICBpZiAoIXVuaXRPZldvcmsgJiYgd2lwUm9vdCkge1xuICAgIGNvbW1pdFJvb3QoKVxuICB9XG5cbiAgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2sod29ya0xvb3ApXG59XG5cbndpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrKHdvcmtMb29wKVxuXG4vKipcbiAqIOavj+S4gOasoeW3peS9nOWkhOeQhuS4gOS4qkZpYmVy5YWD57SgXG4gKiAxLiDmt7vliqBET01cbiAqIDIuIOaehOW7ukZpYmVy6IqC54K5XG4gKiAzLiDov5Tlm57kuIvkuIDkuKpGaWJlcuiKgueCuVxuICogQHBhcmFtIHtGaWJlcn0gZmliZXJcbiAqL1xuZnVuY3Rpb24gcGVyZm9ybVVuaXRPZldvcmsgKGZpYmVyKSB7XG4gIGNvbnN0IGlzRnVuY3Rpb25Db21wb25lbnQgPSBmaWJlci50eXBlIGluc3RhbmNlb2YgRnVuY3Rpb25cblxuICBpZiAoaXNGdW5jdGlvbkNvbXBvbmVudCkge1xuICAgIHVwZGF0ZUZ1bmN0aW9uQ29tcG9uZW50KGZpYmVyKVxuICB9IGVsc2Uge1xuICAgIHVwZGF0ZUhvc3RDb21wb25lbnQoZmliZXIpXG4gIH1cblxuICBpZiAoZmliZXIuY2hpbGQpIHtcbiAgICByZXR1cm4gZmliZXIuY2hpbGRcbiAgfVxuICBsZXQgbmV4dEZpYmVyID0gZmliZXJcbiAgd2hpbGUgKG5leHRGaWJlcikge1xuICAgIGlmIChuZXh0RmliZXIuc2libGluZykge1xuICAgICAgcmV0dXJuIG5leHRGaWJlci5zaWJsaW5nXG4gICAgfVxuICAgIG5leHRGaWJlciA9IG5leHRGaWJlci5wYXJlbnRcbiAgfVxufVxuXG5sZXQgd2lwRmliZXIgPSBudWxsIC8vIOW9k+WJjeS9v+eUqOWIsOeahOWHveaVsOe7hOS7tlxubGV0IGhvb2tJbmRleCA9IDAgLy8g5b2T5YmN57uE5Lu255qE6ZKp5a2Q5LiL5qCHXG5mdW5jdGlvbiB1cGRhdGVGdW5jdGlvbkNvbXBvbmVudCAoZmliZXIpIHtcbiAgd2lwRmliZXIgPSBmaWJlclxuICBob29rSW5kZXggPSAwXG4gIHdpcEZpYmVyLmhvb2tzID0gW11cbiAgY29uc3QgY2hpbGRyZW4gPSBbZmliZXIudHlwZShmaWJlci5wcm9wcyldXG4gIHJlY29uY2lsZUNoaWxkcmVuKGZpYmVyLCBjaGlsZHJlbilcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVN0YXRlIChpbml0aWFsKSB7XG4gIGNvbnN0IG9sZEhvb2sgPVxuICAgIHdpcEZpYmVyLmFsdGVybmF0ZSAmJlxuICAgIHdpcEZpYmVyLmFsdGVybmF0ZS5ob29rcyAmJlxuICAgIHdpcEZpYmVyLmFsdGVybmF0ZS5ob29rc1tob29rSW5kZXhdXG5cbiAgY29uc3QgaG9vayA9IHtcbiAgICBzdGF0ZTogb2xkSG9vayA/IG9sZEhvb2suc3RhdGUgOiBpbml0aWFsLFxuICAgIHF1ZXVlOiBbXVxuICB9XG5cbiAgLy8g5ZCI5bm25omn6KGM5aSa5LiqIHNldFN0YXRlXG4gIGNvbnN0IGFjdGlvbnMgPSBvbGRIb29rID8gb2xkSG9vay5xdWV1ZSA6IFtdXG4gIGFjdGlvbnMuZm9yRWFjaChhY3Rpb24gPT4ge1xuICAgIGhvb2suc3RhdGUgPSBhY3Rpb24oaG9vay5zdGF0ZSlcbiAgfSlcblxuICBjb25zdCBzZXRTdGF0ZSA9IGFjdGlvbiA9PiB7XG4gICAgaG9vay5xdWV1ZS5wdXNoKGFjdGlvbilcbiAgICAvLyDmm7TmlrBcbiAgICB3aXBSb290ID0ge1xuICAgICAgZG9tOiBjdXJyZW50Um9vdC5kb20sXG4gICAgICBwcm9wczogY3VycmVudFJvb3QucHJvcHMsXG4gICAgICBhbHRlcm5hdGU6IGN1cnJlbnRSb290XG4gICAgfVxuICAgIHVuaXRPZldvcmsgPSB3aXBSb290XG4gIH1cblxuICB3aXBGaWJlci5ob29rcy5wdXNoKGhvb2spXG4gIGhvb2tJbmRleCsrXG4gIHJldHVybiBbaG9vay5zdGF0ZSwgc2V0U3RhdGVdXG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUhvc3RDb21wb25lbnQgKGZpYmVyKSB7XG4gIGNvbnN0IHsgdHlwZSwgZG9tLCBwcm9wcyB9ID0gZmliZXJcbiAgaWYgKCFkb20pIHtcbiAgICBmaWJlci5kb20gPSBjcmVhdGVET00odHlwZSlcbiAgICB1cGRhdGVET00oZmliZXIuZG9tLCB7fSwgcHJvcHMpXG4gIH1cbiAgcmVjb25jaWxlQ2hpbGRyZW4oZmliZXIsIHByb3BzLmNoaWxkcmVuKVxufVxuXG4vKipcbiAqXG4gKiBAcGFyYW0ge0ZpYmVyfSB3aXBGaWJlclxuICogQHBhcmFtIHtFbGVtZW50W119IGVsZW1lbnRzXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWNvbmNpbGVDaGlsZHJlbiAod2lwRmliZXIsIGVsZW1lbnRzKSB7XG4gIGxldCBpbmRleCA9IDBcbiAgbGV0IHByZXZTaWJsaW5nID0gbnVsbFxuICBsZXQgb2xkRmliZXIgPSB3aXBGaWJlci5hbHRlcm5hdGUgJiYgd2lwRmliZXIuYWx0ZXJuYXRlLmNoaWxkXG5cbiAgd2hpbGUgKGluZGV4IDwgZWxlbWVudHMubGVuZ3RoIHx8IG9sZEZpYmVyICE9IG51bGwpIHtcbiAgICBjb25zdCBlbGVtZW50ID0gZWxlbWVudHNbaW5kZXhdXG4gICAgY29uc3QgaXNTYW1lVHlwZSA9IG9sZEZpYmVyICYmIGVsZW1lbnQgJiYgb2xkRmliZXIudHlwZSA9PT0gZWxlbWVudC50eXBlXG4gICAgbGV0IG5ld0ZpYmVyID0gbnVsbFxuXG4gICAgaWYgKGlzU2FtZVR5cGUpIHtcbiAgICAgIG5ld0ZpYmVyID0ge1xuICAgICAgICB0eXBlOiBvbGRGaWJlci50eXBlLFxuICAgICAgICBwcm9wczogZWxlbWVudC5wcm9wcyxcbiAgICAgICAgZG9tOiBvbGRGaWJlci5kb20sIC8vIOabtOaWsOWQjOS4gOS4qkRPTVxuICAgICAgICBwYXJlbnQ6IHdpcEZpYmVyLFxuICAgICAgICBlZmZlY3RUYWc6IFVQREFURSxcbiAgICAgICAgYWx0ZXJuYXRlOiBvbGRGaWJlclxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoZWxlbWVudCAmJiAhaXNTYW1lVHlwZSkge1xuICAgICAgbmV3RmliZXIgPSB7XG4gICAgICAgIHR5cGU6IGVsZW1lbnQudHlwZSxcbiAgICAgICAgcHJvcHM6IGVsZW1lbnQucHJvcHMsXG4gICAgICAgIGRvbTogbnVsbCxcbiAgICAgICAgcGFyZW50OiB3aXBGaWJlcixcbiAgICAgICAgZWZmZWN0VGFnOiBQTEFDRU1FTlQsXG4gICAgICAgIGFsdGVybmF0ZTogbnVsbFxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAob2xkRmliZXIgJiYgIWlzU2FtZVR5cGUpIHtcbiAgICAgIG9sZEZpYmVyLmVmZmVjdFRhZyA9IERFTEVUSU9OXG4gICAgICBkZWxldGlvbnMucHVzaChvbGRGaWJlcilcbiAgICB9XG5cbiAgICBpZiAob2xkRmliZXIpIHtcbiAgICAgIG9sZEZpYmVyID0gb2xkRmliZXIuc2libGluZ1xuICAgIH1cblxuICAgIGlmIChpbmRleCA9PT0gMCkge1xuICAgICAgd2lwRmliZXIuY2hpbGQgPSBuZXdGaWJlclxuICAgIH0gZWxzZSBpZiAocHJldlNpYmxpbmcgIT0gbnVsbCkge1xuICAgICAgcHJldlNpYmxpbmcuc2libGluZyA9IG5ld0ZpYmVyXG4gICAgfVxuXG4gICAgcHJldlNpYmxpbmcgPSBuZXdGaWJlclxuICAgIGluZGV4KytcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyIChlbGVtZW50LCBjb250YWluZXIpIHtcbiAgY29uc3QgZmliZXJSb290ID0ge1xuICAgIGRvbTogY29udGFpbmVyLFxuICAgIHByb3BzOiB7XG4gICAgICBjaGlsZHJlbjogW2VsZW1lbnRdXG4gICAgfSxcbiAgICBhbHRlcm5hdGU6IG51bGxcbiAgfVxuICB1bml0T2ZXb3JrID0gZmliZXJSb290XG4gIHdpcFJvb3QgPSBmaWJlclJvb3Rcbn1cbiIsImltcG9ydCB7IHRyaW0sIGlzUHJpbWl0aXZlLCBpc051bGxPclVuZGVmaW5lZCwgZmxhdCB9IGZyb20gJy4uL3V0aWxzJ1xuaW1wb3J0IGNyZWF0ZUVsZW1lbnQgZnJvbSAnLi4vY3JlYXRlRWxlbWVudCdcblxuY29uc3QgcmVnVGFnU3RhcnQgPSAvXjwoXFx3KylcXHMqKFtePl0qKVxccyo+L1xuY29uc3QgcmVnVGFnQ2xvc2UgPSAvXjxcXC8oXFx3KylcXHMqPi9cbmNvbnN0IHJlZ1RhZ1ZhbHVlID0gL15bXjxdKi9cbmNvbnN0IHJlZ1RhZ0F0dHIgPSAvKFtcXHctXSspPVwiKFteXCJdKylcIi9nXG5jb25zdCBUQUdfU1RBUlQgPSAnVEFHX1NUQVJUJ1xuY29uc3QgVEFHX0NMT1NFID0gJ1RBR19DTE9TRSdcbmNvbnN0IFRBR19WQUxVRSA9ICdUQUdfVkFMVUUnXG5jb25zdCBUQUdfQVRUUl9OQU1FID0gJ1RBR19BVFRSX05BTUUnXG5jb25zdCBUQUdfQVRUUl9WQUxVRSA9ICdUQUdfQVRUUl9WQUxVRSdcbmNvbnN0IGlzT2JqZWN0VmFsdWUgPSBrZXkgPT4gL1ByZXNldE9iamVjdFxcZCsvLnRlc3Qoa2V5KVxuY29uc3QgZ2V0T2JqZWN0VmFsdWUgPSAob2JqZWN0cywga2V5KSA9PiB7XG4gIGNvbnN0IHJlZ0V4cCA9IC9QcmVzZXRPYmplY3RcXGQrL1xuICByZXR1cm4gb2JqZWN0c1tyZWdFeHAuZXhlYyhrZXkpWzBdXVxufVxubGV0IGdsb2JhbE9iamVjdHMgPSBudWxsXG5cbmNvbnN0IHBhcnNlVG9rZW4gPSB0ZW1wbGF0ZSA9PiB7XG4gIGxldCB0eXBlID0gJydcbiAgbGV0IG1hdGNoZXMgPSBudWxsXG4gIGxldCB2YWx1ZSA9IG51bGxcbiAgbGV0IGF0dHJzID0gJydcblxuICBpZiAoKG1hdGNoZXMgPSB0ZW1wbGF0ZS5tYXRjaChyZWdUYWdTdGFydCkpKSB7XG4gICAgdHlwZSA9IFRBR19TVEFSVFxuICAgIHZhbHVlID0gbWF0Y2hlc1sxXVxuICAgIGF0dHJzID0gbWF0Y2hlc1syXVxuICB9IGVsc2UgaWYgKChtYXRjaGVzID0gdGVtcGxhdGUubWF0Y2gocmVnVGFnQ2xvc2UpKSkge1xuICAgIHR5cGUgPSBUQUdfQ0xPU0VcbiAgICB2YWx1ZSA9IG1hdGNoZXNbMV1cbiAgfSBlbHNlIGlmICgobWF0Y2hlcyA9IHRlbXBsYXRlLm1hdGNoKHJlZ1RhZ1ZhbHVlKSkpIHtcbiAgICB0eXBlID0gVEFHX1ZBTFVFXG4gICAgdmFsdWUgPSBtYXRjaGVzWzBdXG4gIH0gZWxzZSB7XG4gICAgdGhyb3cgbmV3IFR5cGVFcnJvcignbGV4aWNhbCBlcnJvcicpXG4gIH1cblxuICByZXR1cm4ge1xuICAgIHR5cGUsXG4gICAgdmFsdWUsXG4gICAgc3ViSW5kZXg6IG1hdGNoZXMuaW5kZXggKyBtYXRjaGVzWzBdLmxlbmd0aCxcbiAgICBhdHRyc1xuICB9XG59XG5cbmZ1bmN0aW9uIHBhcnNlQXR0ciAoYXR0cikge1xuICBsZXQgbSA9IG51bGxcbiAgY29uc3QgYXR0cnMgPSBbXVxuXG4gIHdoaWxlICgobSA9IHJlZ1RhZ0F0dHIuZXhlYyhhdHRyKSkpIHtcbiAgICBhdHRycy5wdXNoKHtcbiAgICAgIHR5cGU6IFRBR19BVFRSX05BTUUsXG4gICAgICB2YWx1ZTogbVsxXVxuICAgIH0pXG4gICAgYXR0cnMucHVzaCh7XG4gICAgICB0eXBlOiBUQUdfQVRUUl9WQUxVRSxcbiAgICAgIHZhbHVlOiBtWzJdXG4gICAgfSlcbiAgfVxuICByZXR1cm4gYXR0cnNcbn1cblxuY29uc3QgcGFyc2VMZXhpY2FsID0gdGVtcGxhdGUgPT4ge1xuICBsZXQgdG9rZW5zID0gW11cbiAgbGV0IHRlbXAgPSB0cmltKHRlbXBsYXRlKVxuICB3aGlsZSAodGVtcC5sZW5ndGgpIHtcbiAgICB0ZW1wID0gdHJpbSh0ZW1wKVxuICAgIGNvbnN0IHRva2VuID0gcGFyc2VUb2tlbih0ZW1wKVxuICAgIHRlbXAgPSB0ZW1wLnN1YnN0cmluZyh0b2tlbi5zdWJJbmRleClcbiAgICB0b2tlbnMucHVzaCh0b2tlbilcbiAgICBpZiAodG9rZW4udHlwZSA9PT0gVEFHX1NUQVJUKSB7XG4gICAgICB0b2tlbnMgPSB0b2tlbnMuY29uY2F0KHBhcnNlQXR0cih0b2tlbi5hdHRycykpXG4gICAgfVxuICB9XG4gIHJldHVybiB0b2tlbnNcbn1cblxuY29uc3QgcGFyc2VTeW50YXggPSB0b2tlbnMgPT4ge1xuICBsZXQgaW5kZXggPSAwXG4gIGxldCBuZXh0VG9rZW4gPSB0b2tlbnNbaW5kZXhdXG4gIGxldCBjdXJyZW50ID0gbnVsbFxuICBsZXQgYXR0ck5hbWUgPSAnJ1xuXG4gIGNvbnN0IHRyZWUgPSBjdXJyZW50ID0ge1xuICAgIHR5cGU6ICdyb290JyxcbiAgICBjaGlsZHJlbjogW11cbiAgfVxuXG4gIGNvbnN0IGdvTmV4dCA9ICgpID0+IHtcbiAgICByZXR1cm4gdG9rZW5zWysraW5kZXhdXG4gIH1cblxuICB3aGlsZSAobmV4dFRva2VuKSB7XG4gICAgbGV0IHZhbHVlID0gbmV4dFRva2VuLnZhbHVlXG4gICAgaWYgKGlzT2JqZWN0VmFsdWUodmFsdWUpKSB7XG4gICAgICB2YWx1ZSA9IGdldE9iamVjdFZhbHVlKGdsb2JhbE9iamVjdHMsIHZhbHVlKVxuICAgIH1cbiAgICBpZiAobmV4dFRva2VuLnR5cGUgPT09IFRBR19TVEFSVCkge1xuICAgICAgY29uc3QgdGVtcFJvb3QgPSB7XG4gICAgICAgIHR5cGU6IHZhbHVlLFxuICAgICAgICBjaGlsZHJlbjogW10sXG4gICAgICAgIHByb3BzOiB7fSxcbiAgICAgICAgcGFyZW50OiBjdXJyZW50XG4gICAgICB9XG4gICAgICBjdXJyZW50LmNoaWxkcmVuLnB1c2godGVtcFJvb3QpXG4gICAgICBjdXJyZW50ID0gdGVtcFJvb3RcbiAgICB9IGVsc2UgaWYgKG5leHRUb2tlbi50eXBlID09PSBUQUdfQ0xPU0UpIHtcbiAgICAgIGNvbnN0IHRlbXBSb290ID0gY3VycmVudFxuICAgICAgY3VycmVudCA9IHRlbXBSb290LnBhcmVudFxuICAgICAgZGVsZXRlIHRlbXBSb290LnBhcmVudFxuICAgIH0gZWxzZSBpZiAobmV4dFRva2VuLnR5cGUgPT09IFRBR19BVFRSX05BTUUpIHtcbiAgICAgIGF0dHJOYW1lID0gbmV4dFRva2VuLnZhbHVlXG4gICAgfSBlbHNlIGlmIChuZXh0VG9rZW4udHlwZSA9PT0gVEFHX0FUVFJfVkFMVUUpIHtcbiAgICAgIGN1cnJlbnQucHJvcHNbYXR0ck5hbWVdID0gdmFsdWVcbiAgICB9IGVsc2UgaWYgKG5leHRUb2tlbi50eXBlID09PSBUQUdfVkFMVUUpIHtcbiAgICAgIGN1cnJlbnQuY2hpbGRyZW4ucHVzaCh2YWx1ZSlcbiAgICB9XG5cbiAgICBuZXh0VG9rZW4gPSBnb05leHQoKVxuICB9XG5cbiAgcmV0dXJuIHRyZWUuY2hpbGRyZW5bMF1cbn1cblxuY29uc3QgaXNFeGlzdEluID0gKG9iamVjdHMsIHZhbHVlKSA9PiB7XG4gIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhvYmplY3RzKVxuICBmb3IgKGxldCBpID0gMDsgaSA8IGtleXMubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBrID0ga2V5c1tpXVxuICAgIGlmIChvYmplY3RzW2tdID09PSB2YWx1ZSkge1xuICAgICAgcmV0dXJuIGtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGxcbn1cblxuY29uc3QgcHJlc2V0ID0gKHN0YXRpY3MsIC4uLmVudGl0aWVzKSA9PiB7XG4gIGNvbnN0IG9iamVjdHMgPSB7fVxuICBsZXQgdGVtcGxhdGUgPSAnJ1xuICBsZXQgY291bnQgPSAwXG4gIGxldCBpID0gMFxuICBmb3IgKDsgaSA8IGVudGl0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgbGV0IGUgPSBlbnRpdGllc1tpXVxuICAgIGlmIChpc051bGxPclVuZGVmaW5lZChlKSkge1xuICAgICAgZSA9ICcnXG4gICAgfVxuXG4gICAgaWYgKCFpc1ByaW1pdGl2ZShlKSkge1xuICAgICAgY29uc3QgZXhpc3RrZXkgPSBpc0V4aXN0SW4ob2JqZWN0cywgZSlcbiAgICAgIGlmIChleGlzdGtleSkge1xuICAgICAgICBlID0gZXhpc3RrZXlcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNvbnN0IGtleSA9IGBQcmVzZXRPYmplY3Qke2NvdW50Kyt9YFxuICAgICAgICBvYmplY3RzW2tleV0gPSBlXG4gICAgICAgIGUgPSBrZXlcbiAgICAgIH1cbiAgICB9XG4gICAgdGVtcGxhdGUgKz0gKHN0YXRpY3NbaV0gKyBlKVxuICB9XG4gIHRlbXBsYXRlICs9IHN0YXRpY3NbaV1cbiAgZ2xvYmFsT2JqZWN0cyA9IG9iamVjdHNcbiAgcmV0dXJuIHRlbXBsYXRlXG59XG5cbmNvbnN0IGNvbnZlcnRUb0VsZW1lbnRzID0gdHJlZSA9PiB7XG4gIGlmICh0cmVlLmlzRWxlbWVudCkge1xuICAgIHJldHVybiB0cmVlXG4gIH1cbiAgY29uc3QgY2hpbGRyZW4gPSB0cmVlLmNoaWxkcmVuID8gZmxhdCh0cmVlLmNoaWxkcmVuKS5tYXAoY29udmVydFRvRWxlbWVudHMpIDogW11cbiAgcmV0dXJuIHR5cGVvZiB0cmVlID09PSAnb2JqZWN0JyA/IGNyZWF0ZUVsZW1lbnQodHJlZS50eXBlLCB0cmVlLnByb3BzLCAuLi5jaGlsZHJlbikgOiB0cmVlXG59XG5cbmV4cG9ydCBjb25zdCB0ID0gKHN0YXRpY3MsIC4uLmVudGl0aWVzKSA9PiB7XG4gIGNvbnN0IHRlbXBsYXRlID0gcHJlc2V0KHN0YXRpY3MsIC4uLmVudGl0aWVzKVxuICBjb25zdCB0b2tlbnMgPSBwYXJzZUxleGljYWwodGVtcGxhdGUpXG4gIGNvbnN0IHN5bnRheCA9IHBhcnNlU3ludGF4KHRva2VucylcbiAgcmV0dXJuIGNvbnZlcnRUb0VsZW1lbnRzKHN5bnRheClcbn1cbiIsImltcG9ydCBjcmVhdGVFbGVtZW50IGZyb20gJy4vY3JlYXRlRWxlbWVudCdcbmltcG9ydCB7IHVzZVN0YXRlLCByZW5kZXIgfSBmcm9tICcuL3JlY29uY2lsZSdcbmltcG9ydCB7IHQgfSBmcm9tICcuL3RlbXBsYXRlL3QnXG5cbmV4cG9ydCBkZWZhdWx0IHtcbiAgY3JlYXRlRWxlbWVudCxcbiAgcmVuZGVyLFxuICB1c2VTdGF0ZSxcbiAgdFxufVxuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0VBQU8sTUFBTSxZQUFZLEdBQUcsZUFBYztBQUMxQyxFQUFPLE1BQU0sTUFBTSxHQUFHLFNBQVE7QUFDOUIsRUFBTyxNQUFNLFNBQVMsR0FBRyxZQUFXO0FBQ3BDLEVBQU8sTUFBTSxRQUFRLEdBQUcsVUFBVTs7RUNIM0IsTUFBTSxVQUFVLEdBQUcsR0FBRyxJQUFJLEdBQUcsS0FBSyxVQUFVLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFDO0FBQ3BFLEVBQU8sTUFBTSxPQUFPLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFDO0FBQ2xELEVBQU8sTUFBTSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxJQUFJLENBQUMsR0FB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
