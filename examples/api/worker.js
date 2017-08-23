"use strict";

var Workit = require("../../");

class Api extends Workit.Worker {
  say(data) {
    console.log(process.pid, process.isWorker, data);
    return Promise.resolve("done");
  }
}

module.exports = Api;
