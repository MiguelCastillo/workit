"use strict";

var path = require("path");
var childProcess = require("child_process");
var States = require("./states");

const defaults = {
  cwd: process.cwd(),
  env: process.env
};

class Worker {
  constructor(pool, options) {
    options = options || {};
    this.settings = Object.assign({}, defaults, options);
    this.pool = pool;
    this.pending = {};
    this.jobs = [];
    this.state = States.available;
    this.process = childProcess.fork(path.join(__dirname, "./worker-process.js"), [], this.settings);
  }

  send(type, data) {
    return this.pool.scheduler.queue(type, data, this);
  }

  start(file) {
    registerHandlers(this);

    return this.send("__init", file).catch(error => {
      this.stop();
      this.process.emit("error", error);
    });
  }

  stop() {
    var pool = this.pool;
    var index = pool.workers.indexOf(this);

    if (index !== -1) {
      pool.workers.splice(index, 1);
      this.state = States.stopped;
      this.process.disconnect();
    }
  }

  rejectQueue(error) {
    this.jobs
      .splice(0)
      .forEach(job => job.reject(error));
  }

  _do(job) {
    this.pending[job.message.id] = job;
    this.state = States.executing;
    this.process.send(job.message);
  }
}

function registerHandlers(worker) {
  worker.process
    .on("message", (message) => {
      if (worker.pending.hasOwnProperty(message.id)) {
        worker.state = worker.state === States.executing ? States.available : worker.state;
        handleResult(message, worker.pending[message.id]);
        delete worker.pending[message.id];
      }
      else if (typeof worker.pool.settings[message.type] === "function") {
        if (message.id) {
          Promise.resolve(worker.pool.settings[message.type](message.data))
            .then(data => worker.process.send({ id: message.id, data: data }))
            .catch(error => worker.process.send({ id: message.id, error: error }));
        }
        else {
          worker.pool.settings[message.type](message.data);
        }
      }
    });
}

function handleResult(message, pending) {
  message.error ?
    pending.reject(message.error) :
    pending.resolve(message.data);
}

module.exports = Worker;
