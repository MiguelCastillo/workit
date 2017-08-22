"use strict";

var WorkerApi = require("./api");
var api;

// Tag the current process as child... For convenience.
Object.defineProperties(process, {
  isWorker: {
    get: () => true,
    set: () => { throw new Error("isWorker is a readonly property."); }
  }
});

process.on("message", function(message) {
  if (message.type) {
    switch(message.type) {
      case "__init":
        initProcess(message);
        break;
      default:
        invokeMessage(message);
        break;
    }
  }
  else {
    sendMessage(message);
  }
});

function initProcess(message) {
  try {
    var Api = require(message.data);
    api = typeof Api === "function" && Object.create(Api.prototype) instanceof WorkerApi ? new Api() : Api;
    handleSuccess(message)();
  }
  catch(ex) {
    handlerError(message)(ex);
  }
}

function invokeMessage(message) {
  try {
    var deferred = api[message.type](message.data, (err, data) => err ? handleError(message)(err) : handleSuccess(message)(data));

    if (deferred) {
      deferred.then(handleSuccess(message), handlerError(message));
    }
  }
  catch(ex) {
    handlerError(message)(ex);
  }
}

function sendMessage(message) {
  try {
    var deferred = api(message.data, (err, data) => err ? handleError(message)(err) : handleSuccess(message)(data));

    if (deferred) {
      deferred.then(handleSuccess(message), handlerError(message));
    }
  }
  catch(ex) {
    handlerError(message)(ex);
  }
}

function handleSuccess(message) {
  return function(data) {
    process.send({
      id: message.id,
      data: data
    });
  };
}

function handlerError(message) {
  return function(error) {
    process.send({
      id: message.id,
      error: error ? error.stack || error : "Unknown error"
    });
  };
}
