"use strict";

class WorkerApi {
  onStart() {
  }

  onStop() {
  }

  send(type, data) {
    process.send({ type: type, data: data });
  }
}

module.exports = WorkerApi;
