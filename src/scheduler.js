"use strict";

var States = require("./states");

class Scheduler {
  constructor(pool) {
    this.id = 1;
    this.pool = pool;
    this.messageQueue = [];
  }

  queue(type, data, worker) {
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

      this._processNextMessage(worker);
    })
    .then((result) => {
      this._processNextMessage(worker);
      return result;
    });
  }

  _processNextMessage(worker) {
    var pool = this.pool;
    var availableWorker, messageQueue;

    if (worker && worker.process.connected && worker.state === States.stopped && !worker.messageQueue.length) {
      worker.stop();
    }

    if (worker && worker.state === States.available && worker.messageQueue.length) {
      availableWorker = worker;
      messageQueue = worker.messageQueue;
    }
    else {
      availableWorker = pool.workers.find((worker) => worker.state === States.available);
      messageQueue = this.messageQueue;
    }

    if (availableWorker && messageQueue.length) {
      availableWorker._sendMessage(messageQueue.shift()); // FILO
    }
  }
}

module.exports = Scheduler;
