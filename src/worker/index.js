"use strict";

class Worker {
  onStart() {
  }

  onStop() {
  }

  invoke(type, data) {
    process.send({ type: type, data: data });
  }

  send(data) {
    process.send({ data: data });
  }
}

module.exports = Worker;
