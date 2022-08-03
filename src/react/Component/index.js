import { scheduleUpdate } from '../reconciliation'

class Component {
  constructor(props) {
    this.props = props;
  }

  setState(partialState) {
    scheduleUpdate(this, partialState)
  }
}

export { Component }