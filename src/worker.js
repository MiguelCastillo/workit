"use strict";

var path = require("path");
var childProcess = require("child_process");
var States = require("./states");

const defaults = {
  cwd: process.cwd(),
  env: process.env,
  silent: true,
};

class Worker {
  constructor(pool, options) {
    options = options || {};
    this.settings = Object.assign({}, defaults, options);
    this.pool = pool;
    this.messageQueue = [];
    this.state = States.available;
    this.handle = childProcess.fork(path.join(__dirname, "./worker-process.js"), [], this.settings);
  }

  send(type, data) {
    return this.pool._queueMessage(type, data, this);
  }

  kill() {
    var pool = this.pool;
    var index = pool.procs.indexOf(this);

    if (index !== -1) {
      pool.procs.splice(index, 1);
      this.state = States.stopped;
      this.handle.disconnect();
    }
  }
}

module.exports = Worker;
