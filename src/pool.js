"use strict";

var maxProcess = require("os").cpus().length;
var Worker = require("./worker/adapter");
var States = require("./worker/states");
var id = 1;

class Pool {
  constructor (file, options, args) {
    options = options || {};
    var size = Math.min(options.size || 2, maxProcess);

    this.args = [].concat(args).filter(Boolean);
    this.settings = Object.assign({}, options);
    this.file = file;
    this.jobs = [];
    this.workers = [];
    this.size(size);
  }

  send(data, worker) {
    return this._enqueue(null, data, worker);
  }

  invoke(fn, data, worker) {
    return this._enqueue(fn, data, worker);
  }

  stop() {
    this.workers.forEach(worker => worker.stop());
  }

  rejectQueue(error) {
    this.jobs
      .splice(0)
      .forEach(job => job.reject(error));
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
    var workers = Array.apply(null, Array(count)).map(() => new Worker(this, this.settings, this.args));
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

  _enqueue(fn, data, worker) {
    return new Promise((resolve, reject) => {
      // I would love to use a weak map keyed by worker instance. This would
      // remove the need to have an array of jobs in the worker.
      var jobs = worker ? worker.jobs : this.jobs;

      jobs.push({
        message: {
          id: id++,
          type: fn,
          data: data
        },
        resolve: resolve,
        reject: reject
      });

      this._processNextJob(worker);
    })
    .then((result) => {
      this._processNextJob(worker);
      return result;
    });
  }

  _processNextJob(worker) {
    var availableWorker, jobs;

    if (worker && worker.process.connected && worker.state === States.stopped && !worker.jobs.length) {
      worker.stop();
    }

    if (worker && worker.state === States.available && worker.jobs.length) {
      availableWorker = worker;
      jobs = worker.jobs;
    }
    else {
      availableWorker = this.workers.find((worker) => worker.state === States.available);
      jobs = this.jobs;
    }

    if (availableWorker && jobs.length) {
      availableWorker._do(jobs.shift()); // FIFO
    }
  }
}

module.exports = Pool;
