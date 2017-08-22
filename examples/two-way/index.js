"use strict";

var path = require("path");
var Workit = require("../../index");

class Pool extends Workit.Pool {
  workerSaid(data) {
    console.log(process.pid, process.isWorker, data);
  }
}

var workerPool = new Pool(path.join(__dirname, "./worker.js"));

workerPool.invoke("say", "hello world").then(() => {
  workerPool.stop(); // Stop worker pool so that parent process can exit gracefully.
});
