var Pool = require("./src/pool");
Pool.WorkerApi = require("./src/worker-api");

Object.defineProperty(Pool, "isWorker", {
  get: function() {
    return process.isWorker;
  },
  set: function() {
    throw new Error("isWorker is a readonly property.");
  }
});

module.exports = Pool;
