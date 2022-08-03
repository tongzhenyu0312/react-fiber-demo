import { updateNodeElement } from '../DOM';
import {
  createTaskQueue,
  arrified,
  createStateNode,
  getTag,
  getRoot,
} from '../Misc';

const taskQueue = createTaskQueue();

let subTask = null;

let pendingCommit = null;

const commitAllWork = (fiber) => {
  fiber.effects.forEach((item) => {
    if (item.tag === 'class_component') {
      item.stateNode.__fiber = item;
    }

    if (item.effectTag === 'delete') {
      item.parent.stateNode.removeChild(item.stateNode);
    } else if (item.effectTag === 'placement') {
      // 类组件本身属于节点，但是不是一个有效的dom元素
      let fiber = item;
      let parentFiber = item.parent;

      // 一直找到有效dom节点
      while (
        parentFiber.tag === 'class_component' ||
        parentFiber.tag === 'function_component'
      ) {
        parentFiber = parentFiber.parent;
      }
      // 找到有效dom，再进行添加
      if (fiber.tag === 'host_component') {
        parentFiber.stateNode.appendChild(item.stateNode);
      }
    } else if (item.effectTag === 'update') {
      // 更新
      if (item.type === item.alternate.type) {
        // 节点类型相同
        updateNodeElement(item.stateNode, item, item.alternate);
      } else {
        // 节点类型不同
        item.parent.stateNode.replaceChild(
          item.stateNode,
          item.alternate.stateNode,
        );
      }
    }
  });

  /**
   * 备份旧的节点对象
   */
  fiber.stateNode.__rootFiberContainer = fiber;
};

/**
 * 从队列中获取一个fiber任务
 * @returns
 */
const getFirstTask = () => {
  // 从任务队列中获取队伍
  const task = taskQueue.pop();

  // 判断任务来源是否是组件更新
  if (task.from === 'class_component') {
    const root = getRoot(task.instance);
    console.log(root);
    task.instance.__fiber.partialState = task.partialState;

    return {
      props: root.props,
      stateNode: root.stateNode,
      tag: 'host_root', // 根节点不需要动态获取tag
      effects: [], // 存储需要更改的Fiber对象
      child: null, // 子级Fiber
      alternate: root, // 根节点fiber对象存储的旧fiber
    };
  }

  // 构建fiber对象
  // 返回最外层节点的Fiber对象
  return {
    // 最外层节点不需要type
    props: task.props,
    stateNode: task.dom,
    tag: 'host_root', // 根节点不需要动态获取tag
    effects: [], // 存储需要更改的Fiber对象
    child: null, // 子级Fiber
    alternate: task.dom.__rootFiberContainer, // 根节点fiber对象存储的旧fiber
  };
};

/**
 * 协调fiber任务和其子fiber（互相建立关系）
 * @param {*} fiber
 * @param {*} children
 */
const reconcileChildren = (fiber, children) => {
  // 根节点的children定义为对象，这里统一类型
  const arrifiedChildren = arrified(children);

  let index = 0;
  let numberOfElements = arrifiedChildren.length;
  let element = null;
  let newFiber = null;
  let prevFiber = null;

  // 查找备份节点
  let alternate = null;
  if (fiber.alternate && fiber.alternate.child) {
    alternate = fiber.alternate.child;
  }

  // arrifiedChildren可能不存在，所以
  while (index < numberOfElements || alternate) {
    element = arrifiedChildren[index];

    // 根据备份节点是否存在，进行对应操作
    if (!element && alternate) {
      // 删除操作
      alternate.effectTag = 'delete';
      fiber.effects.push(alternate);
    } else if (element && alternate) {
      // 更新操作
      newFiber = {
        type: element.type,
        props: element.props,
        tag: getTag(element), // 动态获取tag值
        effects: [],
        effectTag: 'update', // "update" "delete"
        // stateNode: null,
        parent: fiber,
        alternate,
      };

      if (element.type === alternate.type) {
        // 类型相同
        newFiber.stateNode = alternate.stateNode;
      } else {
        // 类型不同
        // statNode根据fiber类型不同，有不同的内容，交由一个函数处理
        newFiber.stateNode = createStateNode(newFiber);
      }
    } else if (element && !alternate) {
      // 新增操作
      newFiber = {
        type: element.type,
        props: element.props,
        tag: getTag(element), // 动态获取tag值
        effects: [],
        effectTag: 'placement', // "update" "delete"
        // stateNode: null,
        parent: fiber,
      };

      // statNode根据fiber类型不同，有不同的内容，交由一个函数处理
      newFiber.stateNode = createStateNode(newFiber);
    }

    if (index === 0) {
      fiber.child = newFiber;
    } else if (element) {
      prevFiber.sibling = newFiber;
    }

    // 只有第一个子节点是child，后面都是通过sibling去找
    if (alternate && alternate.sibling) {
      alternate = alternate.sibling;
    } else {
      alternate = null;
    }

    prevFiber = newFiber;

    index++;
  }
};

/**
 * 执行一个fiber任务
 * @param {*} fiber
 */
const executeTask = (fiber) => {
  if (fiber.tag === 'class_component') {
    if (fiber.stateNode.__fiber && fiber.stateNode.__fiber.partialState) {
      fiber.stateNode.state = {
        ...fiber.stateNode.state,
        ...fiber.stateNode.__fiber.partialState,
      }
    }
    reconcileChildren(fiber, fiber.stateNode.render());
  } else if (fiber.tag === 'function_component') {
    reconcileChildren(fiber, fiber.stateNode(fiber.props));
  } else {
    reconcileChildren(fiber, fiber.props.children);
  }

  // 若存在子fiber，将子fiber作为下一个任务执行
  if (fiber.child) {
    return fiber.child;
  }

  let currentExecuteFiber = fiber;

  // 查找的核心, 最终会退回根节点
  while (currentExecuteFiber.parent) {
    // 收集effects数组，每一个节点收集底下所有的fiber
    currentExecuteFiber.parent.effects =
      currentExecuteFiber.parent.effects.concat(
        currentExecuteFiber.effects.concat([currentExecuteFiber]),
      );

    // 先找同级
    if (currentExecuteFiber.sibling) {
      return currentExecuteFiber.sibling;
    }
    // 没有同级，找父级，进而查找父级的同级
    currentExecuteFiber = currentExecuteFiber.parent;
  }

  pendingCommit = currentExecuteFiber;

  console.log(fiber);
};

const workLoop = (deadline) => {
  // 检出一个任务
  if (!subTask) {
    subTask = getFirstTask();
  }

  /**
   * 在浏览器剩余时间充足时，执行任务
   */
  while (subTask && deadline.timeRemaining() > 1) {
    // 执行一个fiber后，返回下一个fiber作为任务，继续执行
    subTask = executeTask(subTask);
  }

  // 第二阶段
  if (pendingCommit) {
    commitAllWork(pendingCommit);
  }
};

/**
 * 执行任务函数
 * @param {} deadline
 */
const performTask = (deadline) => {
  // 循环执行任务
  workLoop(deadline);

  /**
   * 当前任务没有执行完，或任务队列没有清空，继续通知浏览器执行任务
   */
  if (subTask || !taskQueue.isEmpty()) {
    requestIdleCallback(performTask);
  }
};

/**
 * 使用Fiber完成将virtualDom渲染到指定节点
 * @param {*} element virtualDom
 * @param {*} dom 最外层是root
 */
export const render = (element, dom) => {
  /**
   * 1. 任务队列添加任务
   * 2. 指定浏览器空闲时执行任务
   */

  /**
   * 任务队列添加任务，每一个任务初始形态是一个对象
   * 任务是通过vdom对象构建Fiber对象
   */
  taskQueue.push({
    dom,
    props: { children: element },
  });

  /**
   * 通知浏览器在空余时间执行任务
   */
  requestIdleCallback(performTask);
};

export const scheduleUpdate = (instance, partialState) => {
  taskQueue.push({
    from: 'class_component',
    instance,
    partialState,
  });

  requestIdleCallback(performTask);
};
