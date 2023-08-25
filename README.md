# redis-objects
Redis Objects - Storage Interface for Javascript Objects

# Overview
Easily store and retrieve multi-layered objects in [Redis](http://redis.io), including preservation of complex data structures and original data types.  Includes an optional object cache abstraction layer that saves data changes in real-time to Redis.

# Features

 (placeholder)


# How Data Is Stored

(placeholder, show how data is stored in Redis)

# Getting Started

## Installation

Using NPM:
```
$ npm install redis-json
```

## Usage

Start by including and creating a new redis-objects interface.

``` javascript
const RedisObjects = require('redis-objects');


// Initialize interface w/optional params
const redisObjects = new RedisObjects(); // Supply optional config object (see below)
```

### config
``` javascript
const config = {
    redis: false,           // Supply already-created ioRedis connection 
                            // (spawns its own if absent)

    ioRedisOptions: false,  // ioRedis connection options (optional, connects 
                            // to localhost:6379 if absent)

    storagePath: false,     // Optional root redis path, ie "cache"

    cacheMode: false,       // Optional values: false,"realtime","snapshot" 
                            // By default (or false), no caching is used
}
```

### put

Writes an object to Redis

``` javascript

await redisObjects.put("someObject", {
    key1: "1234",
    key2: {
        a: "key2 a string",
        b: false
    }
});

/*
    Stores: (placeholder)
*/

```


