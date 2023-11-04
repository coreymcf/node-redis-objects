# node-redis-objects

Node Redis Objects - Storage Interface for Javascript Objects

# Overview

Easy to use package for storing objects in [Redis](http://redis.io), including preservation of complex data structures and original data types. Includes an optional object cache abstraction layer that saves data changes in real-time to Redis.

# Features

- Easily store and retrieve objects from Redis.
- Handles complex structures and data types.
- Method to ensure changes are saved in execution sequence.
- Compatible with on-change package. (see examples)

# How Data Is Stored

Objects are automatically "flattened" via ":" separators so they can be stored in Redis and "unflattened" when retrieved.

```json
{
  "foo": true,
  "a": {
    "b": [
      {
        "c": true
      }
    ]
  }
}
```

Is stored in Redis as:

```
object:foo = true
object:foo.meta = {"type":"boolean"}
object:a:b:0:c = true
object:a:b:0:c.meta = {"type":"boolean"}
```

# Getting Started

## Installation

Using NPM:

```
$ npm install redis-objects
```

## Basic Usage

```javascript
// Start by importing redis-objects.
const RedisObjects = require("node-redis-objects"); // or: import RedisObjects from "node-redis-objects"

// Create new RedisObjects interface (config optional)
const redisObjects = new RedisObjects();

// Save an object
await redisObjects.put("test", {
  a: "a",
});

// Get an object
const test = await redisObjects.get("test");
```

## Config

```js
const config = {
  redis: false, // Supply already-created ioRedis connection (spawns its own if absent)
  ioRedisOptions: false, // ioRedis connection options (optional, connects to localhost:6379 if absent)
  storagePath: false, // Optional root redis path, ie "cache"
  heartbeat: 1000, // Optional value: interval (in ms)
};

const redisObjects = new RedisObjects(config);
```

## Commands

### put( objectName, objectValue, ttl )

Writes an object to Redis
(Promise, use await or standard Promise chains)

```js
await redisObjects.put("someObject", {
  key1: "1234",
  key2: {
    a: "key2 a string",
    b: false,
  },
});
```

Stores

```
someObject:key2:a = key2 a string
someObject:key2:b = false
someObject:key1 = 1234
someObject:key2:b.meta = {"type":"boolean"}
```

### get( objectName )

Gets an object from Redis
(Promise, use await or standard Promise chains)

```js
await redisObjects.get("someObject");
```

Returns

```json
{
  "key1": "1234",
  "key2": {
    "a": "key2 a string",
    "b": false
  }
}
```

### update ( { name, path, value, oldValue, ttl } )

Save (or delete) object values. (Structurally compatible with on-change package.)
(Promise, use await or standard Promise chains)

Note: When using the on-change package, see the 'queueUpdate' method below.

```js
await redisObjects.update({
  name: `someObject`, // Object name
  path: `key2.b`,
  value: "9876",
  oldValue: false, // Optional, supplied by on-change. (oldValue=value is skipped)
  ttl: false, // Optional TTL (in seconds)
});
```

Stores

```
someObject:key2:b = 9876
```

### queueUpdate ( { name, path, value, oldValue, ttl } )

Queue a request to save (or delete) object values. (Structurally compatible with on-change package.)
(Promise, use await or standard Promise chains)

The update queue is utilized to ensure changes are processed in the order received.

```js
await redisObjects.queueUpdate({
  name: `someObject`, // Object name
  path: `key2.b`,
  value: "9876",
  oldValue: false, // Optional, supplied by on-change. (oldValue=value is skipped)
  ttl: false, // Optional TTL (in seconds)
});
```

Stores

```
someObject:key2:b = 9876
```

### close()

Closes Redis connection.

```js
redisObjects.close();
```

### call()

Call an arbitrary ioredis command. (See ioredis/redis for commands documentation.)

```js
const redisDbSize = await redisObjects.call("dbsize");
```

### ping()

Redis PING. Returns PONG.

```js
await redisObjects.ping();
```

### getLastHeartbeat()

Returns timestamp from last RedisObjects heartbeat. (Useful for testing age of data is using in a caching application.)

```js
const lastHeartbeat = await redisObjects.getLastHeartbeat();
const downMs = lastHeartbeat > 0 ? Math.floor(+Date.now() - lastHeartbeat) : 0;
const cacheDownSecs = downMs > 0 ? Math.ceil(downMs / 1000) : 0;
```

### startHeartBeat( interval )

Starts a loop with the optional interval (default 1000ms), updating the "redisObjectsHeartbeat" with the current timestamp. This happens automatically if the config parameter `heartbeat` is set.

```js
redisObjects.startHeartBeat();
```

### writeHeartBeat()

Writes the current timestamp to "redisObjectsHeartbeat".

```js
redisObjects.writeHeartBeat();
```

### flushall()

Flushes (erases) entire Redis database.

```js
await redisObjects.flushall();
```

## Events

Events are passthrough from ioredis.

| Event   | Description                                                                                                                                                                                                                                     |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| connect | emits when a connection is established to the Redis server.                                                                                                                                                                                     |
| ready   | If `enableReadyCheck` is `true`, client will emit `ready` when the server reports that it is ready to receive commands (e.g. finish loading data from disk).<br>Otherwise, `ready` will be emitted immediately right after the `connect` event. |

| error | emits when an error occurs while connecting.<br>However, ioredis emits all `error` events silently (only emits when there's at least one listener) so that your application won't crash if you're not listening to the `error` event. |
| close | emits when an established Redis server connection has closed. |
| reconnecting | emits after `close` when a reconnection will be made. The argument of the event is the time (in ms) before reconnecting. |
| end | emits after `close` when no more reconnections will be made, or the connection is failed to establish. |
| wait | emits when `lazyConnect` is set and will wait for the first command to be called before connecting. |

(Refer to ioredis documentation for more information on these events.)
