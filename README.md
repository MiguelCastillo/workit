# workit
Workit is a utility for parallel processing. The approach is that of a thread pool in which a queue of jobs exists and workers pick new jobs as they finish their work. But instead of using threads, we use child processes.

Parallel processing is traditionally difficult code to write, and that's exactly the problem workit aims to solve for you. Workit accomplishes this by providing you with abstractions for easily defining a Worker API you interact with, managing the lifecycle of the worker processes, and managing the distribution of the workload. All you have to do is define a Worker API that you interact with via a Worker Pool.

So how does this thing work?  Well - let's think about the setup starting with the worker. A worker is ultimately the child process that processes your data, and you have a couple of ways to define one.

- A module that exports a function which we refer to as a worker function.
- A module that exports an API by defining a class that extends `Worker` with methods that process your data. We refer to this as a Worker API.

Then you have a worker pool, which is the component you interact with to talk to the workers. A worker pool exposes several methods, but the two important ones for interacting with worker processes are `send` and `invoke`. You use `send` when interacting with a worker function, and you use `invoke` when you interact with a Worker API.

# Examples

## basic setup

The most basic setup is when the pool and the worker are both defined in the same file. This is perhaps an overly simplistic setup, but it is available if you need it.

``` javascript
import Workit from "workit";

if (process.isWorker) {
  console.log(process.pid, process.isWorker, "hello world");
}
else {
  var workerPool = new Workit.Pool(__filename);
  workerPool.stop();
}
```

## Loading a worker module that exports a worker function

index.js
``` javascript
import path from "path";
import Workit from "workit";

var workerPool = new Workit.Pool(path.join(__dirname, "./worker.js"));

workerPool.send("hello world").then(() => {
  workerPool.stop();
});
```

worker.js
``` javascript
export default function(data, done) {
  console.log(process.pid, process.isWorker, data);
  done();
};
```

run it
```
$ node index.js
```


## Loading a worker module that exports a worker api

index.js
``` javascript
import path from "path";
import Workit from "workit";

var workerPool = new Workit.Pool(path.join(__dirname, "./worker.js"));

workerPool.invoke("say", "hello world").then((data) => {
  console.log("received", data);
  workerPool.stop();
});
```

worker.js
``` javascript
import Workit from "workit";

class Api extends Workit.Worker {
  say(data) {
    console.log(process.pid, process.isWorker, data);
    return Promise.resolve("done");
  }
}

export default Api;
```

run it
```
$ node index.js
```

## Worker process talking to the worker pool

index.js
``` javascript
import path from "path";
import Workit from "workit";

class Pool extends Workit.Pool {
  workerSaid(data) {
    console.log(process.pid, process.isWorker, data);
  }
}

var workerPool = new Pool(path.join(__dirname, "./worker.js"));

workerPool.invoke("say", "hello world").then(() => {
  workerPool.stop();
});
```

worker.js
``` javascript
import Workit from "workit";

class Api extends Workit.Worker {
  say(data, done) {
    console.log(process.pid, process.isWorker, data);
    this.invoke("workerSaid", "hello back");
    done();
  }
}

export default Api;
```

run it
```
$ node index.js
```


# API

## Workit

workit provides you with several different constructs to make parallel processing simple.

- Pool
- Worker
- isWorker

## Pool(filename: string, options: {}, child-args: [])

Class that manages the queue of jobs and worker processes. You can extend Pool in order to define methods that worker processes can invoke, which allows you to build a two way communication between parent and child processes. You can take a look at the example below for `Worker process talking to Process pool`. The constructor takes several arguments:

1. The name of the file to spin up as child process.
2. Settings for the worker pool, which get passed down to the child process.
3. Child process arguments

``` javascript
new Pool(path.join(__dirname, "./worker.js"), { size: 2 }, ["--color"]);
```

For a list of available options for the child process, please take a look at the [nodes child_process.fork](https://nodejs.org/api/child_process.html#child_process_child_process_fork_modulepath_args_options) documentation.

On top of those options, you can pass in the initial size of the pool by specifying `size` as in the example above.


### send(data, worker)

Method to send data to a Worker function.

- data - payload to be sent to the worker process. It can be anything.
- worker - optional worker instance that should process the data. Otherwise, the scheduling algorithm will pick the worker for you, which is the default behavior.

The call returns a promise that resolves when the worker process is done processing the data.

The example below sends a string to be processed by a worker function.
``` javascript
workerPool.send("Hello world").then(() => console.log("done"));
```

### invoke(fn, data, worker)

Method that invokes a method defined in a Worker API.

- fn - method to be called in the Worker API.
- data - payload to be sent to the Worker API method (fn). It can be anything.
- worker - optional worker instance that should process the data. Otherwise, the scheduling algorithm will pick the worker for you, which is the default behavior.

The call returns a promise that resolves when the worker process is done processing the data.

The example below sends a string to be process by the method `say` in a worker api.
``` javascript
workerPool.invoke("say", "Hello world").then(() => console.log("done"));
```

### stop()

Method that stops all workers from processing further jobs. All workers will finish processing whatever they are doing before they exit.

``` javascript
workerPool.stop();
```

### rejectQueue(error)

Method the rejects all queued jobs that are pending processing. The jobs are rejected with the given error.

``` javascript
workerPool.rejectQueue();
```

### size(value)

Method that sets the size of the worker pool. The value is absolute, meaning that if you specify 4 then the pool will have a size of 4 worker processes. If the value is smaller than the current, then the pool is reduced to that size gracefully allowing the worker that are going to be removed finish their work. If the value is bigger than the current, then the pool size is increased and jobs are assigned to each worker as needed.

- value - the new size of the worker pool.

``` javascript
workerPool.size(2);
```

### workers[]

Array of all the workers. The workers in this array are essentially an adapter for interacting with the underlying worker process. You have several methods available to you that allow you to interact directly with specific worker processes.

### workers[].send(data)

Method for sending data to a specific Worker function.

``` javascript
workerPool.workers.forEach((worker) => worker.send("Hello world"));
```

### workers[].invoke(fn, data)

Method for invoking a method on a specific Worker API method.

``` javascript
workerPool.workers.forEach((worker) => worker.invoke("say", "Hello wold"));
```

### workers[].stop()

Method to stop a specific worker. This will gracefully let the worker process finish any work in progress before stopping it.

``` javascript
workerPool.workers.forEach((worker) => worker.stop());
```


## Worker

Class that allows you to define an API that a worker pool can invoke. All you need to do is extend the Worker class to define your API methods, and export it. Workit will internally manage the lifecycle of your Worker API. The methods exposed by the API get two parameters

- data - data to be processed by the method
- done - a function to be called when the worker method has finished processing the data. You can alternatively return a Promise. If any data is passed to `done` or the resolved promise, that data will be received by the worker pool for the particular job.

Export a simple Worker API with a method `say` that a worker pool can invoke.
``` javascript
import Workit form 'workit';

class Worker extends Workit.Worker {
  say(data) {
    return Promise.resolve("got it");
  }
}

export default Worker;
```

## isWorker

Flag that is true if the code reading the value is executing in a worker process. Otherwise the value is not defined. `isWorker` is also available in `process.isWorker`.



## Thanks!!

> workit used to be taken up in npm by the now defunct project (https://github.com/shannonmoeller/workit). The author - Shannon - of that project is amazing and let me have the name. Thank you, Shannon!
