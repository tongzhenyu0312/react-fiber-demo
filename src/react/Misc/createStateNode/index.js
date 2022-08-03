import { createDomElement } from '../../DOM'
import { createReactInstance } from '../createReactInstance'

/**
 * 不同类型的fiber对应的节点（普通节点对应dom、组件对应实例）
 * @param {*} fiber 
 */
const createStateNode = (fiber) => {
  // tag区分普通节点还是组件
  if (fiber.tag === 'host_component') {
    return createDomElement(fiber)
  } else {
    return createReactInstance(fiber)
  }
}
export default createStateNode