"use strict";

var maxProcess = require("os").cpus().length;
var States = require("./states");
var Worker = require("./worker");
var Scheduler = require("./scheduler");

class Pool {
  constructor (file, options) {
    options = options || {};
    var size = Math.min(options.size || 2, maxProcess);

    this.settings = Object.assign({}, options);
    this.file = file;
    this.scheduler = new Scheduler(this);
    this.workers = [];
    this.size(size);
  }

  send(type, data) {
    return this.scheduler.queue(type, data);
  }

  stop() {
    this.workers.forEach((worker) => worker.stop());
  }

  rejectQueue(error) {
    this.scheduler.rejectQueue(error);
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
    workers.forEach(worker => worker.start(this.file));
    this.workers = this.workers.concat(workers);
  }

  _remove(count) {
    if (count <= 0) {
      throw new Error("Number of items to be removed must be greater than 0");
    }

    this.workers
      .sort((a, b) => (
        a.state === States.available ? -1 :
        a.jobs.length < b.jobs.length ? -1 : 1
      ))
      .slice(0, count)
      .forEach(worker => worker.stop());
  }
}

module.exports = Pool;
