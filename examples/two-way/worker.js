"use strict";

var Work = require("../../");

class Api extends Work.Worker {
  say(data, done) {
    console.log(process.pid, process.isWorker, data);
    this.invoke("workerSaid", "hello back");
    done();
  }
}

module.exports = Api;
