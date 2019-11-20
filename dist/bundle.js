
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.head.appendChild(r) })(window.document);
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = global || self, global.Treact = factory());
}(this, (function () { 'use strict';

  const TEXT_ELEMENT = 'TEXT_ELEMENT';

  function createElement(type, props, ...children) {
    return {
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

  function createTextElement(text) {
    return {
      type: TEXT_ELEMENT,
      props: {
        nodeValue: text,
        children: []
      }
    }
  }

  const isProperty = key => key !== 'children';

  function render (element, container) {
    const { type, props } = element;

    const $dom = type === TEXT_ELEMENT
      ? document.createTextNode('')
      : document.createElement(element.type);

    Object.keys(props)
      .filter(isProperty)
      .forEach(name => {
        $dom[name] = element.props[name];
      });

    props.children.forEach(child => render(child, $dom));

    container.appendChild($dom);
  }

  var index = {
    createElement,
    render
  };

  return index;

})));
