var Workit = require("../../index");

if (process.isWorker) {
  console.log(process.pid, process.isWorker, "hello world");
}
else {
  var workerPool = new Workit.Pool(__filename);
  workerPool.stop(); // Stop worker pool so that parent process can exit gracefully.
}
