module.exports = function(data, done) {
  console.log(process.pid, process.isWorker, data);
  done();
};
