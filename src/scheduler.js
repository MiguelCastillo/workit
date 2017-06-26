"use strict";

var States = require("./worker/states");

class Scheduler {
  constructor(pool) {
    this.id = 1;
    this.pool = pool;
    this.jobs = [];
  }

  queue(type, data, worker) {
    return new Promise((resolve, reject) => {
      var id = this.id++;
      var jobs = worker ? worker.jobs : this.jobs;

      jobs.push({
        message: {
          id: id,
          type: type,
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

  rejectQueue(error) {
    this.jobs
      .splice(0)
      .forEach(job => job.reject(error));
  }

  _processNextJob(worker) {
    var pool = this.pool;
    var availableWorker, jobs;

    if (worker && worker.process.connected && worker.state === States.stopped && !worker.jobs.length) {
      worker.stop();
    }

    if (worker && worker.state === States.available && worker.jobs.length) {
      availableWorker = worker;
      jobs = worker.jobs;
    }
    else {
      availableWorker = pool.workers.find((worker) => worker.state === States.available);
      jobs = this.jobs;
    }

    if (availableWorker && jobs.length) {
      availableWorker._do(jobs.shift()); // FILO
    }
  }
}

module.exports = Scheduler;
