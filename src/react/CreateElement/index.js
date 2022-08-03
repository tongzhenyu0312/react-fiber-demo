export default function createElement(type, props, ...children) {
  const childElements = [].concat(...children).reduce((result, child) => {
    // 子节点为布尔或空时，不应该被算作虚拟节点
    if (child !== false  && child !== true && child !== null) {
      if (child instanceof Object) {
        result.push(child);
      } else {
        // 只有标签才会被转换为React.createElement，字符串不属于标签，所以不会自动转换为virtualDom对象，需要手动转换。
        result.push(createElement('text', { textContent: child }));
      }
    }
    return result;
  }, []);

  return {
    type,
    // props中应该包含children
    props: Object.assign({ children: childElements }, props),
  };
}
