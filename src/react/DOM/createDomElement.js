import updateNodeElement from './updateNodeElement'

/**
 * 为fiber创建真实dom
 * @param {*} virtualDom 
 * @returns 
 */
export default function createDomElement(virtualDom) {
  let newElement = null;
  
  // 当前的节点，需要区分是否为元素节点/文本节点，他们对应的创建方法是不一样的
  if (virtualDom.type === 'text') {
    // 文本节点
    // 文本节点不需要添加属性
    newElement = document.createTextNode(virtualDom.props.textContent);
  } else {
    // 元素节点
    newElement = document.createElement(virtualDom.type);
    // 创建完Dom元素，为Dom元素添加属性，属性存储在virtualDom.props中
    // 只有普通元素需要添加属性
    updateNodeElement(newElement, virtualDom);
  }

  return newElement;
}
