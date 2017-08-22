var path = require("path");
var Workit = require("../../index");

var workerPool = new Workit.Pool(path.join(__dirname, "./worker.js"));

workerPool.invoke("say", "hello world").then(() => {
  workerPool.stop(); // Stop worker pool so that parent process can exit gracefully.
});
