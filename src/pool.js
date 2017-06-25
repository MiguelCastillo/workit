"use strict";

var maxProcess = require("os").cpus().length;
var States = require("./states");
var Worker = require("./worker");

class Pool {
  constructor (file, options) {
    options = options || {};
    var size = Math.min(options.size || 2, maxProcess);

    this.settings = Object.assign({}, options);
    this.file = file;
    this.id = 1;
    this.pending = {};
    this.messageQueue = [];
    this.procs = [];
    this.size(size);
  }

  send(type, data) {
    return this._queueMessage(type, data);
  }

  kill() {
    this.procs.forEach((proc) => proc.kill());
  }

  size(size) {
    var currentSize = this.procs.length;

    if (size > currentSize) {
      this._add(size - currentSize);
    }
    else if (size < currentSize) {
      this._remove(currentSize - size);
    }
  }

  _add(count) {
    var procs = Array.apply(null, Array(count)).map(() => new Worker(this, this.settings));

    procs.forEach(proc => {
      registerProcHandlers(this, proc);
      initProcess(this, proc, this.file);
    });

    this.procs = this.procs.concat(procs);
  }

  _remove(count) {
    if (count <= 0) {
      throw new Error("Number of items to be removed must be greater than 0");
    }

    this.procs
      .sort((a, b) => (
        a.state === States.available ? -1 :
        a.messageQueue.length < b.messageQueue.length ? -1 : 1
      ))
      .slice(0, count)
      .forEach(proc => this.kill(proc));
  }

  _queueMessage(type, data, proc) {
    return new Promise((resolve, reject) => {
      var id = this.id++;
      var messageQueue = proc ? proc.messageQueue : this.messageQueue;

      messageQueue.push({
        message: {
          id: id,
          type: type,
          data: data
        },
        resolve: resolve,
        reject: reject
      });

      processNextMessage(this, proc);
    })
    .then((result) => {
      processNextMessage(this, proc);
      return result;
    });
  }
}

function processNextMessage(pool, proc) {
  var availableProc, messageQueue;

  if (proc && proc.handle.connected && proc.state === States.stopped && !proc.messageQueue.length) {
    proc.kill();
  }

  if (proc && proc.state === States.available && proc.messageQueue.length) {
    availableProc = proc;
    messageQueue = proc.messageQueue;
  }
  else {
    availableProc = pool.procs.find((proc) => proc.state === States.available);
    messageQueue = pool.messageQueue;
  }

  if (availableProc && messageQueue.length) {
    var envelope = messageQueue.shift(); // FILO
    pool.pending[envelope.message.id] = envelope;
    availableProc.state = States.executing;
    availableProc.handle.send(envelope.message);
  }
}

function initProcess(pool, proc, file) {
  proc.send("__init", file).catch(error => {
    proc.kill();

    proc.messageQueue
      .splice(0)
      .forEach(envelope => envelope.reject("Unable to initialize child process.\n" + error));

    if (!pool.procs.length && pool.messageQueue.length) {
      pool.messageQueue
        .splice(0)
        .forEach(envelope => envelope.reject("Unable to initialize child process.\n" + error));
    }
  });
}

function registerProcHandlers(pool, proc) {
  proc.handle
    .on("error", (error) => {
      process.stderr.write(`===> process error [${proc.handle.pid}]` + error + "\n");
    })
    .on("message", (message) => {
      if (pool.pending.hasOwnProperty(message.id)) {
        proc.state = proc.state === States.executing ? States.available : proc.state;
        handleResult(message, pool.pending[message.id], proc);
        delete pool.pending[message.id];
      }
      else if (typeof pool.settings[message.type] === "function") {
        if (message.id) {
          Promise.resolve(pool.settings[message.type](message.data))
            .then(data => proc.handle.send({ id: message.id, data: data }))
            .catch(error => proc.handle.send({ id: message.id, error: error }));
        }
        else {
          pool.settings[message.type](message.data);
        }
      }
    });
}

function handleResult(message, pending) {
  message.error ?
    pending.reject(message.error) :
    pending.resolve(message.data);
}

module.exports = Pool;
