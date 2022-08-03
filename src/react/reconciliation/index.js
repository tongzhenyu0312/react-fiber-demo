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
  // 通过effects来渲染所有fiber
  fiber.effects.forEach((item) => {
    // 类组件fiber被执行时，在类组件实例绑定fiber
    if (item.tag === 'class_component') {
      item.stateNode.__fiber = item;
    }

    if (item.effectTag === 'delete') {
      // 删除
      item.parent.stateNode.removeChild(item.stateNode);
    } else if (item.effectTag === 'placement') {
      // 初始渲染时，每个fiber的effect都是 placement
      let fiber = item;
      let parentFiber = item.parent;
      
      // 组件本身属于节点，但没有对应的真实dom去组装，所以一直再次向上找父fiber
      while (
        parentFiber.tag === 'class_component' ||
        parentFiber.tag === 'function_component'
      ) {
        parentFiber = parentFiber.parent;
      }

      // 进行真实dom树的组装，一直组装到根fiber的node（root），实现了页面的渲染
      if (fiber.tag === 'host_component') {
        parentFiber.stateNode.appendChild(item.stateNode);
      }

    } else if (item.effectTag === 'update') {
      // 渲染更新
      if (item.type === item.alternate.type) {
        // 节点类型相同，只需要更新对应的props
        updateNodeElement(item.stateNode, item, item.alternate);
      } else {
        // 节点类型不同，就用新的节点替换旧的节点
        item.parent.stateNode.replaceChild(
          item.stateNode,
          item.alternate.stateNode,
        );
      }
    }
  });

  // 在渲染阶段备份fiber，为了将来更新用，绑定在root节点上
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
    // 通过类实例获取根fiber
    const root = getRoot(task.instance);
    task.instance.__fiber.partialState = task.partialState;

    // 组件更新时，返回的根fiber
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
    effects: [], // 存储需要更改的Fiber对象，将来用来渲染到页面
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

  // 循环children的索引
  let index = 0;
  // children数量
  let numberOfElements = arrifiedChildren.length;
  // 循环当前的vdom
  let element = null;
  // fiber对象
  let newFiber = null;
  // 上一个fiber对象
  let prevFiber = null;

  // 获取fiber的备份，也是从child链路开始
  let alternate = null;
  if (fiber.alternate && fiber.alternate.child) {
    // 得到child子fiber备份
    alternate = fiber.alternate.child;
  }

  // arrifiedChildren可能不存在，所以
  while (index < numberOfElements || alternate) {
    element = arrifiedChildren[index];

    // 根据备份节点是否存在，进行对应操作
    if (!element && alternate) {
      // 删除操作
      alternate.effectTag = 'delete';
      // 删除操作只需要在fiber的effects添加一个 旧fiber（被标记为删除）
      fiber.effects.push(alternate);
    } else if (element && alternate) {
      // jsx和备份fiber都存在，说明是更新操作
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
        // 备份fiber和当前virtualDom类型相同，说明节点没有变化
        newFiber.stateNode = alternate.stateNode;
      } else {
        // 备份fiber和当前virtualDom类型不同，需要创建一个新的stateNode
        newFiber.stateNode = createStateNode(newFiber);
      }
    } else if (element && !alternate) {
      // 新增操作

      // 为children构建fiber对象
      newFiber = {
        type: element.type,
        props: element.props,
        tag: getTag(element), // 动态获取tag值 有host_component function_component class_component等区分，根节点是host_root
        effects: [], // 用来存储此节点下的所有fiber
        effectTag: 'placement', // 标识该节点为新增，除此之外还有 "update" "delete"
        parent: fiber, // 父fiber，建立子fiber与父fiber关系
      };

      // 普通fiber对应的真实dom，类组件的stateNode是class，函数组件的stateNode是函数
      newFiber.stateNode = createStateNode(newFiber);
    }

    if (index === 0) {
      // 父fiber下第一个子fiber
      fiber.child = newFiber;
    } else if (element) {
      // 其他的子fiber通过前一个子fiber进行关联
      prevFiber.sibling = newFiber;
    }

    // 只有第一个子节点是child，后面都是通过sibling去找
    // 对应构建fiber，也更新一下 备份的fiber
    if (alternate && alternate.sibling) {
      alternate = alternate.sibling;
    } else {
      alternate = null;
    }

    // 当前fiber称为了下一个fiber的上前一个fiber
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
      // 通过组件实例获取state，合并需要更新的state
      fiber.stateNode.state = {
        ...fiber.stateNode.state,
        ...fiber.stateNode.__fiber.partialState,
      }
    }
    // 类组件的fiber，其children是其内部的jsx
    reconcileChildren(fiber, fiber.stateNode.render());
  } else if (fiber.tag === 'function_component') {
    // 函数组件的fiber，是函数本身
    reconcileChildren(fiber, fiber.stateNode(fiber.props));
  } else {
    // 为普通的fiber构建关系
    reconcileChildren(fiber, fiber.props.children);
  }

  // 若存在子fiber，将子fiber作为下一个任务执行
  if (fiber.child) {
    return fiber.child;
  }

  /**
   * 当前不存在子fiber时，就要考虑找同级fiber
   */
  let currentExecuteFiber = fiber;

  // 查找第一条子fiber链路以外的fiber
  while (currentExecuteFiber.parent) {
    // 父fiber收集其下的所有fiber（包含自身）
    currentExecuteFiber.parent.effects =
      currentExecuteFiber.parent.effects.concat(
        // 收集当前fiber
        currentExecuteFiber.effects.concat([currentExecuteFiber]),
      );

    // 当父fiber存在时，找一找同级下一个fiber作为任务
    if (currentExecuteFiber.sibling) {
      return currentExecuteFiber.sibling;
    }

    // 同级的fiber没了，通过循环，找父级的同级fiber
    currentExecuteFiber = currentExecuteFiber.parent;
  }

  // 所有fiber都构建完成后，最终必然回到 根fiber
  pendingCommit = currentExecuteFiber;
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

  // 第二阶段（渲染阶段），从根fiber开始
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
   * 只要有任务，就会通知浏览器空闲时间去执行
   */
  if (subTask || !taskQueue.isEmpty()) {
    requestIdleCallback(performTask);
  }
};

/**
 * 使用Fiber完成将virtualDom渲染到指定节点，我们就来看看是怎么转换virtualDom的吧
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

/**
 * 用于类组件的更新
 * @param {*} instance 
 * @param {*} partialState 
 */
export const scheduleUpdate = (instance, partialState) => {
  taskQueue.push({
    from: 'class_component',
    instance,
    partialState,
  });

  requestIdleCallback(performTask);
};
