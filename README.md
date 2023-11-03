# redis-objects

Redis Objects - Storage Interface for Javascript Objects

# Overview

Easily store and retrieve multi-layered objects in [Redis](http://redis.io), including preservation of complex data structures and original data types. Includes an optional object cache abstraction layer that saves data changes in real-time to Redis.

# Features

(placeholder)

# How Data Is Stored

(placeholder, show how data is stored in Redis)

# Getting Started

## Installation

Using NPM:

```
$ npm install redis-objects
```

## Basic Usage

```javascript
// Start by importing redis-objects.
const RedisObjects = require("redis-objects");

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
  redis: false, // Supply already-created ioRedis connection
  // (spawns its own if absent)

  ioRedisOptions: false, // ioRedis connection options (optional, connects
  // to localhost:6379 if absent)

  storagePath: false, // Optional root redis path, ie "cache"

  cacheMode: false, // Optional values: false,"realtime","snapshot"
  // By default (or false), no caching is used
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
