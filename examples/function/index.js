var path = require("path");
var Work = require("../../index");

var workerPool = new Work.Pool(path.join(__dirname, "./worker.js"));

workerPool.send("hello world").then(() => {
  workerPool.stop(); // Stop worker pool so that parent process can exit gracefully.
});
