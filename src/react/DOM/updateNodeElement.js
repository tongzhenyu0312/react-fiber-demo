/**
 * 为Dom元素添加属性，属性存储在virtualDom.props中
 * 若存在oldVirtualDom，需要比对属性后添加
 * @param {*} newElement
 * @param {*} virtualDom
 * @param {*} oldVirtualDom
 */
export default function updateNodeElement(
  newElement,
  virtualDom,
  oldVirtualDom,
) {
  const newProps = virtualDom.props || {};
  // 挂载阶段是没有oldVirtualDom的，所以需要短路符兜底
  const oldProps = (oldVirtualDom && oldVirtualDom.props) || {};

  // 处理文本节点
  if (virtualDom.type === 'text') {
    if (newProps.textContent !== oldProps.textContent) {
      // 更新文本节点

      if (virtualDom.parent.type !== oldVirtualDom.parent.type) {
        // 父级节点类型不同，直接在新父级内添加
        virtualDom.parent.stateNode.appendChild(
          document.createTextNode(newProps.textContent),
        )
      } else {
        // 父级节点类型相同，做替换操作
        virtualDom.parent.stateNode.replaceChild(
          document.createTextNode(newProps.textContent),
          oldVirtualDom.stateNode,
        )
      }
    }
    return
  }

  Object.keys(newProps).forEach((propName) => {
    const newPropsValue = newProps[propName];
    const oldPropsValue = oldProps[propName];

    // 处理元素节点
    // 新旧属性有变化的场景
    if (newPropsValue !== oldPropsValue) {  
      // 不同属性类型要有不同处理方式
      if (propName.slice(0, 2) === 'on') {
        // 事件属性
        const eventName = propName.toLowerCase().slice(2);
        newElement.addEventListener(eventName, newPropsValue);
        // 事件更新需要移除旧的事件监听
        if (oldPropsValue) {
          newElement.removeEventListener(eventName, oldPropsValue);
        }
      } else if (propName === 'value' || propName === 'checked') {
        // 属性名为value或checked，不能使用setAttribute
        newElement[propName] = newPropsValue;
      } else if (propName !== 'children') {
        // children属性不需要添加到元素属性中
        if (propName === 'className') {
          newElement.setAttribute('class', newPropsValue);
        } else {
          newElement.setAttribute(propName, newPropsValue);
        }
      }

    }
  });

  // 旧属性被删除的场景（旧的属性存在，新的属性不存在）
  Object.keys(oldProps).forEach((propName) => {
    const newPropsValue = newProps[propName];
    const oldPropsValue = oldProps[propName];

    // 新的属性不存在，说明已经被删除了
    if (!newPropsValue) {
      // 不同属性，有不同的删除方式
      if (propName.slice(0, 2) === 'on') {
        // 事件属性
        const eventName = propName.toLowerCase().slice(2);
        newElement.removeEventListener(eventName, oldPropsValue);
      } else if(propName !== 'children') {
        // value和checked属性也可以通过removeAttribute来删除
        newElement.removeAttribute(propName, newPropsValue);
      }
    }
  })
}
