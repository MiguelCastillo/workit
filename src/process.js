"use strict";

class Process {
  constructor(pool, options) {
    this.settings = Object.assign({}, options);
    this.messageQueue = [];
    this.state = processState.available;
    this.handle = childProcess.fork(path.join(__dirname, "./child.js"), [], this.settings);
  }

  kill() {
    this.handle.kill();
  }
}

module.exports = Process;
