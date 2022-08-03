import { Component } from "../../Component"


const getTag = (vdom) => {
  // 根据不同类型获取不同tag
  if (typeof vdom.type === 'string') {
    // 普通节点的type一定是字符串，不管是text文本节点还是元素节点
    return 'host_component'
  } else if (Object.getPrototypeOf(vdom.type) === Component) {
    return 'class_component'
  } else {
    return 'function_component'
  }
}

export default getTag