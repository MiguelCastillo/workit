"use strict";

var Workit = require("../../");

class Api extends Workit.Worker {
  say(data, done) {
    console.log(process.pid, process.isWorker, data);
    this.invoke("workerSaid", "hello back");
    done();
  }
}

module.exports = Api;
