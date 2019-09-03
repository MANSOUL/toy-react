import { TAG_CLOSE, TAG_OPEN, TAG_VALUE, TAG_ATTR_NAME, TAG_ATTR_VALUE } from './tagType.js';
import { arrToMap } from './utils.js';

let currentIndex, lookAhead, tokens;

const nextToken = () => {
  lookAhead = tokens[++currentIndex];
}

const match = type => {
  if (lookAhead && lookAhead.type === type) {
    nextToken();
  } else {
    throw SyntaxError('语法错误');
  }
}

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
}

export default function generateAST (ts) {
  tokens = ts;
  currentIndex = 0;
  lookAhead = tokens[currentIndex];
  let ast = LL.start();
  return ast;
}