"use strict";

var maxProcess = require("os").cpus().length;
var States = require("./states");
var Worker = require("./worker");

class Pool {
  constructor (file, options) {
    options = options || {};
    var size = Math.min(options.size || 2, maxProcess);

    this.settings = Object.assign({}, options);
    this.file = file;
    this.id = 1;
    this.pending = {};
    this.messageQueue = [];
    this.workers = [];
    this.size(size);
  }

  send(type, data) {
    return this._queueMessage(type, data);
  }

  kill() {
    this.workers.forEach((worker) => worker.kill());
  }

  size(size) {
    var currentSize = this.workers.length;

    if (size > currentSize) {
      this._add(size - currentSize);
    }
    else if (size < currentSize) {
      this._remove(currentSize - size);
    }
  }

  _add(count) {
    var workers = Array.apply(null, Array(count)).map(() => new Worker(this, this.settings));

    workers.forEach(worker => {
      registerWorkerHandlers(this, worker);
      worker.start(this.file);
    });

    this.workers = this.workers.concat(workers);
  }

  _remove(count) {
    if (count <= 0) {
      throw new Error("Number of items to be removed must be greater than 0");
    }

    this.workers
      .sort((a, b) => (
        a.state === States.available ? -1 :
        a.messageQueue.length < b.messageQueue.length ? -1 : 1
      ))
      .slice(0, count)
      .forEach(worker => worker.kill());
  }

  _queueMessage(type, data, worker) {
    return new Promise((resolve, reject) => {
      var id = this.id++;
      var messageQueue = worker ? worker.messageQueue : this.messageQueue;

      messageQueue.push({
        message: {
          id: id,
          type: type,
          data: data
        },
        resolve: resolve,
        reject: reject
      });

      processNextMessage(this, worker);
    })
    .then((result) => {
      processNextMessage(this, worker);
      return result;
    });
  }
}

function processNextMessage(pool, worker) {
  var availableWorker, messageQueue;

  if (worker && worker.handle.connected && worker.state === States.stopped && !worker.messageQueue.length) {
    worker.kill();
  }

  if (worker && worker.state === States.available && worker.messageQueue.length) {
    availableWorker = worker;
    messageQueue = worker.messageQueue;
  }
  else {
    availableWorker = pool.workers.find((worker) => worker.state === States.available);
    messageQueue = pool.messageQueue;
  }

  if (availableWorker && messageQueue.length) {
    var envelope = messageQueue.shift(); // FILO
    pool.pending[envelope.message.id] = envelope;
    availableWorker.state = States.executing;
    availableWorker.handle.send(envelope.message);
  }
}

function registerWorkerHandlers(pool, worker) {
  worker.handle
    .on("error", (error) => {
      process.stderr.write(`===> process error [${worker.handle.pid}]` + error + "\n");
    })
    .on("message", (message) => {
      if (pool.pending.hasOwnProperty(message.id)) {
        worker.state = worker.state === States.executing ? States.available : worker.state;
        handleResult(message, pool.pending[message.id], worker);
        delete pool.pending[message.id];
      }
      else if (typeof pool.settings[message.type] === "function") {
        if (message.id) {
          Promise.resolve(pool.settings[message.type](message.data))
            .then(data => worker.handle.send({ id: message.id, data: data }))
            .catch(error => worker.handle.send({ id: message.id, error: error }));
        }
        else {
          pool.settings[message.type](message.data);
        }
      }
    });
}

function handleResult(message, pending) {
  message.error ?
    pending.reject(message.error) :
    pending.resolve(message.data);
}

module.exports = Pool;
