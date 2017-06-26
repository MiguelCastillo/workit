var path = require("path");
var WorkerPool = require("../../index");

var workerPool = new WorkerPool(path.join(__dirname, "./worker.js"));
workerPool.stop(); // Stop worker pool so that parent process can exit gracefully.
