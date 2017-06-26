"use strict";

var maxProcess = require("os").cpus().length;
var Worker = require("./worker");
var States = require("./worker/states");
var Scheduler = require("./scheduler");

class Pool {
  constructor (file, options) {
    options = options || {};
    var size = Math.min(options.size || 2, maxProcess);

    this._api = {};
    this.settings = Object.assign({}, options);
    this.file = file;
    this.scheduler = new Scheduler(this);
    this.workers = [];
    this.size(size);
  }

  withApi(api) {
    this._api = api;
    return this;
  }

  send(data) {
    return this.scheduler.enqueue(null, data);
  }

  invoke(fn, data) {
    return this.scheduler.enqueue(fn, data);
  }

  stop() {
    this.workers.forEach(worker => worker.stop());
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

  _removeWorker(worker) {
    var index = this.workers.indexOf(worker);

    if (index !== -1) {
      var newWorkers = this.workers.slice(0);
      newWorkers.splice(index, 1);
      this.workers = newWorkers;
    }
  }
}

module.exports = Pool;
