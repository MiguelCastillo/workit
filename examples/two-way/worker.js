"use strict";

var WorkerPool = require("../../");

class Api extends WorkerPool.WorkerApi {
  say(data, done) {
    console.log(process.pid, process.isWorker, data);
    this.invoke("workerSaid", "hello back");
    done();
  }
}

module.exports = Api;
