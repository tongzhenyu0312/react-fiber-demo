/**
 * 向上找到根节点fiber对象
 * @param {*} instance 
 * @returns 
 */
const getRoot = (instance) => {
  // 组件渲染时，会绑定fiber
  let fiber = instance.__fiber;
  // 从组件对应fiber可以一直找到根fiber
  while (fiber.parent) {
    fiber = fiber.parent
  }
  return fiber;
}
export default getRoot;