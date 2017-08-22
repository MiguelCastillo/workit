module.exports = {};
module.exports.Pool = require("./src/pool");
module.exports.Worker = require("./src/worker/api");
module.exports.isWorker = process.isWorker;
