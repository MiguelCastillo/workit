"use strict";

var childProcess = require("child_process");
var path = require("path");

build(2, path.join(__dirname, "./worker.js"), {
  cwd: process.cwd(),
  env: process.env,
  silent: true
});

function build(count, file, options) {
  return init(create(count, file, options));
}

function create(count, file, options) {
  return Array.apply(null, Array(count)).map(() => childProcess.fork(file, [], options));
}

function init(procs) {
  procs.forEach(proc => {
    proc.stdout.pipe(process.stdout);
    proc.stderr.pipe(process.stderr);
  });

  return procs;
}
