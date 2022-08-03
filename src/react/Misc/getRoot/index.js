/**
 * 向上找到根节点fiber对象
 * @param {*} instance 
 * @returns 
 */
const getRoot = (instance) => {
  let fiber = instance.__fiber;
  while (fiber.parent) {
    fiber = fiber.parent
  }
  return fiber;
}
export default getRoot;