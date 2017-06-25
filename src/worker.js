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
    this.pending = {};
    this.messageQueue = [];
    this.state = States.available;
    this.handle = childProcess.fork(path.join(__dirname, "./worker-process.js"), [], this.settings);
  }

  send(type, data) {
    return this.pool.scheduler.queue(type, data, this);
  }

  start(file) {
    registerHandlers(this);

    return this.send("__init", file).catch(error => {
      this.stop();

      this.messageQueue
        .splice(0)
        .forEach(envelope => envelope.reject("Unable to initialize worker.\n" + error));

      var pool = this.pool;

      if (!pool.workers.length && pool.messageQueue.length) {
        pool.messageQueue
          .splice(0)
          .forEach(envelope => envelope.reject("Unable to initialize worker.\n" + error));
      }
    });
  }

  stop() {
    var pool = this.pool;
    var index = pool.workers.indexOf(this);

    if (index !== -1) {
      pool.workers.splice(index, 1);
      this.state = States.stopped;
      this.handle.disconnect();
    }
  }

  _sendMessage(envelope) {
    this.pending[envelope.message.id] = envelope;
    this.state = States.executing;
    this.handle.send(envelope.message);
  }
}

function registerHandlers(worker) {
  worker.handle
    .on("error", (error) => {
      process.stderr.write(`===> process error [${worker.handle.pid}]` + error + "\n");
    })
    .on("message", (message) => {
      if (worker.pending.hasOwnProperty(message.id)) {
        worker.state = worker.state === States.executing ? States.available : worker.state;
        handleResult(message, worker.pending[message.id]);
        delete worker.pending[message.id];
      }
      else if (typeof worker.pool.settings[message.type] === "function") {
        if (message.id) {
          Promise.resolve(worker.pool.settings[message.type](message.data))
            .then(data => worker.handle.send({ id: message.id, data: data }))
            .catch(error => worker.handle.send({ id: message.id, error: error }));
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
