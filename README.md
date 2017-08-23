# workit
workit is a worker pool that manages parallel processing of jobs (tasks). The approach is that of a thread pool in which a queue of jobs exists and workers pick new jobs as they finish their work.

> Currently the name workit is taken up in npm by the now defunct project (https://github.com/shannonmoeller/workit). But the author (Shannon) of that project has been kind enough to let me have the name. Once I get the name I should be able to publish this to npm, which will hopefully happen in the next few days.

# API

## Workit

Is a module that exposes three main items.

- Pool
- Worker
- isWorker

## Pool

Class that manages the worker processes. You can extend Pool in order to introduce methods that worker processes can invoke. You can take a look at the example below for `Worker process talking to Process pool`.

### send(data, worker)

Method to send data to a worker function.

- data - payload to be sent to the worker process. It can be anything.
- worker - optional worker instance that should process the data. Otherwise, the scheduling algorithm will pick the worker for you, which is the default behavior.

The call returns promise that resolves when the worker process calls `done` or resolves the promise it returns.

The example below sends a string to be processed by a worker function.
``` javascript
workerPool.send("Hello world").then(() => console.log("done"));
```

### invoke(fn, data, worker)

Method that invokes a method define in a worker module.

- fn - method to be called in the worker process.
- data - payload to be sent to the worker process. It can be anything.
- worker - optional worker instance that should process the data. Otherwise, the scheduling algorithm will pick the worker for you, which is the default behavior.

The call returns promise that resolves when the worker process calls `done` or resolves the promise it returns.

The example below sends a string to be process by the method `say` in a worker api.
``` javascript
workerPool.invoke("say", "Hello world").then(() => console.log("done"));
```

### stop()

Method that stops all workers from processing further messages. All workers will finish processing whatever they are doing before they exit.

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

## Worker

Class that allows you to define an API that a worker pool can invoke. All you need to do is extend the Worker class to define your API methods, and export it. Workit will internally manage the life cycle of your worker API. The methods exposed by the API get two parameters

- data - data to be processed by the method
- done - a function to be called when the worker method has finished processing the data. You can alternatively return a Promise. If any data is passed to `done` or the resolved promise, that data will be received by the process pool promise returned by `invoke` or `send`.

Export a simple worker api with a method `say` that a pool can invoke.
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


# Examples

## basic setup

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
