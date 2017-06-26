"use strict";

var WorkerPool = require("../../");

class Api extends WorkerPool.WorkerApi {
  say(data, done) {
    console.log(process.pid, process.isWorker, data);
    done();
  }
}

module.exports = Api;
