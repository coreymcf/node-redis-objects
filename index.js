/**
 *  Redis Objects - Storage Interface for Javascript Objects
 *  @module redis-objects
 *  @license MIT
 *  @author Corey S. McFadden <coreymcf@gmail.com>
 */
const Redis = require("ioredis");
const isEqual = require("lodash.isequal");
const events = require("events");
const flatten = require("flat");
const { getValueType, isJSON } = require("./utls.js");

class RedisObjects extends events.EventEmitter {
  constructor(props) {
    super(props);

    this.storagePath = props?.storagePath ? props.storagePath : false;

    this.queue = []; // Update queue
    this.queueLock = false; // Update lock

    // Connect to ioRedis
    this._connect(props);
  }

  /**
   * Connect to ioRedis and manage connection
   */
  _connect(props) {
    // ioRedis Client
    this.client = props?.redis
      ? props.redis
      : props?.ioRedisOptions
      ? new Redis(props.ioRedisOptions)
      : new Redis();

    this.client.on("connect", () => {
      this.emit("connect", `RedisObjects connected to Redis.`);
    });

    this.client.on("ready", () => {
      this.emit("ready", `RedisObjects ready to receive commands.`);

      props?.heartbeat && this.startHeartBeat(props.heartbeat);
    });

    this.client.on("error", (err) => {
      this.emit("error", err);
    });

    this.client.on("close", () => {
      this.emit("close", `RedisObjects connection closed.`);
    });

    this.client.on("end", () => {
      this.emit("end", `RedisObjects connection ended.`);
    });

    this.client.on("wait", () => {
      this.emit("wait", `RedisObjects Waiting for first command...`);
    });

    /**
     * @todo Add reconnect handling
     */
  }

  /**
   * Recursively delete object from Redis
   * @param {string} key
   * @param {string} path
   * @returns
   */
  _deleteKeyPath(key, path) {
    return new Promise(async (resolve) => {
      try {
        const redis = this.client;
        let type = await redis.type(`${key}:${path}`);

        // Hash key
        if (type === "none") {
          let [tp, tk] = this._extractFinalSegment(path);
          await redis.hdel(`${key}${tp ? ":" + tp : ""}`, tk);
        }

        // Root
        if (type === "hash" || type === "string") {
          await redis.del(`${key}:${path}`);
        }

        // Branches
        let [ix, children] = [false, []];
        while (ix !== "0") {
          [ix, children] = await redis.scan(
            ix || "0",
            "MATCH",
            `${key}:${path}*`
          );
          if (children.length > 0) {
            for (let d of children) {
              await redis.del(d);
            }
          }
        }
        resolve(true);
      } catch (err) {
        resolve(false);
        throw new Error(`RedisObjects _deleteKeyPath ERROR: ${err}`);
      }
    });
  }

  /**
   * Extract key name from a full redis ":" path.
   * @param {string} str - Redis ":" delimited path string.
   * @returns array
   */
  _extractFinalSegment(str) {
    const [, a, b] = /^(.*):([^:]+)$/.exec(str) || ["", false, str];
    return [a, b];
  }

  /**
   * Save item to Redis
   * @param {object} i - typeof value
   * @param {string} i.key - Redis Key
   * @param {string} i.item - Redis Item
   * @param {*} i.value - Item Value
   * @param {int} i.ttl - TTL (secs) (optional)
   * @returns Promise
   */
  async _saveItem({ key, item, value, ttl = false, oldValue }) {
    try {
      const redis = this.client;
      let type = getValueType(value);
      const oldType = getValueType(oldValue);

      key = this.storagePath ? this.storagePath + ":" + key : key;
      const fullKey = item ? `${key}:${item}` : key;

      const metaKey = `${fullKey}.meta`;
      let setMeta = false;

      // Delete old meta key (if applicable)
      switch (oldType) {
        case "number":
        case "raw":
        case "json":
        case "boolean":
        case "function":
        case "null":
        case "map":
        case "set":
          await redis.del(metaKey);
          break;
        default:
      }

      // Save
      switch (type) {
        case "string":
          if (item) {
            await redis.hset(key, item, value);
          } else {
            await redis.set(key, value);
          }
          break;

        case "date":
          await redis.set(metaKey, JSON.stringify({ type }));
          setMeta = true;
          if (item) {
            await redis.hset(key, item, value.toISOString());
          } else {
            await redis.set(key, value.toISOString());
          }
          break;

        case "number":
        case "raw":
        case "json":
        case "boolean":
          await redis.set(metaKey, JSON.stringify({ type }));
          setMeta = true;
          if (item) {
            await redis.hset(key, item, value);
          } else {
            await redis.set(key, value);
          }
          break;

        case "array":
        case "object":
          if (item) {
            await redis.hset(key, item, JSON.stringify(value));
          } else {
            await redis.hset(key, JSON.stringify(value));
          }
          break;

        case "function":
          await redis.set(
            metaKey,
            JSON.stringify({
              type: !value.toString().includes("function")
                ? "es6_function"
                : type,
            })
          );
          setMeta = true;
          if (item) {
            await redis.hset(key, item, JSON.stringify(value.toString()));
          } else {
            await redis.set(key, JSON.stringify(value.toString()));
          }
          break;

        case "null":
        case "map":
        case "set":
          await redis.set(metaKey, JSON.stringify({ type }));
          setMeta = true;

          const saveThis =
            type !== "null" ? JSON.stringify(Array.from(value)) : "null";
          if (item) {
            await redis.hset(key, item, saveThis);
          } else {
            await redis.set(key, saveThis);
          }
          break;

        case "undefined":
          if (item) {
            await redis.hdel(key, item);
          } else {
            await redis.del(key);
          }
          break;

        default:
          throw new Error(
            `RedisObjects _saveItem ERROR: Unmatched type '${type}'.`
          );
      }

      // Set expires async
      ttl && redis.expire(key, ttl);
      ttl && setMeta && redis.expire(metaKey, ttl);

      return true;
    } catch (err) {
      throw new Error(`RedisObjects _saveItem ERROR: ${err}`);
    }
  }

  /**
   * Close Redis connection
   */
  async close() {
    await this.client.disconnect();
  }

  /**
   * Run abitrary ioredis command
   * @param {string} cmd - Command name
   * @param {*} params - Parameters
   * @returns
   */
  async call(cmd, params) {
    try {
      if (params) {
        return await this.client.call(cmd, params);
      } else {
        return await this.client.call(cmd);
      }
    } catch (err) {
      throw new Error(`RedisObjects exec ERROR: ${err}`);
    }
  }

  /**
   * Flush cache (delete all)
   * @returns Promise
   */
  async flushall() {
    return new Promise(async (resolve, reject) => {
      try {
        await this.client.flushall();
        resolve(true);
      } catch (err) {
        this.u.e(err);
      }
    });
  }

  /**
   * Get an object from redis recursively
   * @param {string} path
   * @returns Object
   */
  async get(path) {
    return new Promise(async (resolve) => {
      try {
        const redis = this.client;
        const originalPath = path;
        path = this.storagePath ? this.storagePath + ":" + path : path;
        let workingObject = {};
        let workingChildren = [];
        let [ix, children] = [false, []];
        while (ix !== "0") {
          [ix, children] = await redis.scan(ix || "0", "MATCH", `${path}*`);
          if (children.length > 0) {
            workingChildren.push(...children);
          }
        }

        // Scan found something.  Object handling.
        if (workingChildren.length > 0) {
          workingChildren = workingChildren.sort();
          const rp = redis.pipeline();
          workingChildren.forEach((key) => rp.hgetall(key));
          const data = await rp.exec();

          await Promise.all(
            workingChildren.map(async (c, ix) => {
              const [e, d] = data[ix] || ["error", false];
              if (e === null) {
                let wrk = { [c]: {} };
                for (let k in d) {
                  const _mk = `${c}:${k}.meta`;
                  let _ktype = typeof d[k];
                  if (workingChildren.includes(_mk)) {
                    const mk = JSON.parse(await redis.get(_mk));
                    _ktype = mk.type;
                  }
                  switch (_ktype) {
                    case "number":
                      d[k] = Number(d[k]);
                      break;
                    case "date":
                      d[k] = new Date(Date.parse(d[k]));
                      break;
                    case "map":
                      d[k] = isJSON(d[k]) ? new Map(JSON.parse(d[k])) : d[k];
                      break;
                    case "null":
                      d[k] = null;
                      break;
                    case "boolean":
                      d[k] = d[k] === "true" ? true : false;
                      break;
                    case "set":
                      d[k] = isJSON(d[k]) ? new Set(JSON.parse(d[k])) : d[k];
                      break;
                    case "es6_function":
                      const efunc = JSON.parse(d[k]) || "";
                      const efax = efunc.match(/\(([^)]*)\)/);
                      const efArgs = efax
                        ? efax[1].split(",").map((arg) => arg.trim())
                        : [];
                      const efBody = (efunc.match(/(?<={)([\s\S]*)(?=})/) || [
                        "",
                      ])[0];
                      d[k] = eval(`(${efArgs.join(", ")}) => {${efBody}}`);
                      break;
                    case "function":
                      const func = JSON.parse(d[k]) || "";
                      const funcname = func.match(/^function (\w+)/) || "";
                      const fax = func.match(/\(([^)]*)\)/);
                      const fArgs = fax
                        ? fax[1].split(",").map((arg) => arg.trim())
                        : [];
                      const fBody = (func.match(/(?<={)([\s\S]*)(?=})/) || [
                        "",
                      ])[0];
                      //                      d[k] = new Function(...fArgs, fBody);
                      d[k] = new Function(
                        ...fArgs,
                        `return function ${funcname}(${fArgs.join(
                          ", "
                        )}) {${fBody}}`
                      )();
                      break;
                    case "json":
                      break;
                    default:
                      d[k] = isJSON(d[k]) ? JSON.parse(d[k]) : d[k];
                      typeof d[k] === "string" &&
                        (d[k] =
                          d[k].substring(0, 7) === "JSON}}}"
                            ? d[k].substring(7)
                            : d[k]);
                  }
                  wrk[c] = { ...wrk[c], [k]: d[k] };
                }
                workingObject = { ...workingObject, ...wrk };
              }
            })
          );

          workingObject = flatten.unflatten(workingObject, {
            delimiter: ":",
            object: true,
            safe: true,
          });
        }

        // Scan found nothing, so check for other datatype...
        if (Object.keys(workingObject).length === 0) {
          let type = await redis.type(path);
          switch (type) {
            case "string":
              workingObject = await redis.get(path);
              break;
            case "hash":
              workingObject = await redis.hgetall(path);
              break;
            case "none":
              workingObject = {};
              break;
            default:
              workingObject = {};
              throw new Error(
                `RedisObjects get ERROR: Unmatched type '${type}'.`
              );
          }
        }

        resolve(
          originalPath !== path
            ? workingObject[this.storagePath][originalPath]
            : workingObject[path] || workingObject
        );
      } catch (err) {
        throw new Error(`RedisObjects get ERROR: ${err}`);
      }
    });
  }

  /**
   * Get last heartbeat (epbxHeartbeat) timestamp
   * @returns integer
   */
  getLastHeartbeat() {
    return new Promise(async (resolve, reject) => {
      try {
        const hb = await this.client.get("redisObjectsHeartbeat");
        resolve(hb || 0);
      } catch (err) {
        resolve(0);
        throw new Error(`RedisObjects getLastHeartbeat ERROR: ${err}`);
      }
    });
  }

  /**
   * redis ping
   * @returns PONG
   */
  async ping() {
    try {
      return await this.client.ping();
    } catch (err) {
      throw new Error(`RedisObjects ping ERROR: ${err}`);
    }
  }

  /**
   * Run await updateObject() for each object in this.queue, w/lock
   */
  async processQueue() {
    try {
      if (this.queueLock) return;
      this.queueLock = true;
      let i;
      while ((i = this.queue.shift())) {
        await this.update(i);
      }
      this.queueLock = false;
      this.queue.length > 0 && this.processQueue();
    } catch (err) {
      throw new Error(`RedisObjects processQueue ERROR: ${err}`);
    }
  }

  /**
   * Write an object to Redis
   * @param {string} name - Object name
   * @param {*} value - Value to store
   * @param {int} ttl - TTL in seconds
   * @returns boolean - Success/fail
   */
  async put(name, value, ttl = false) {
    try {
      return await this.update({
        path: false, // Not needed for root-level storage
        value,
        name,
        oldValue: false, // Always save
        ttl,
      });
    } catch (err) {
      throw new Error(`RedisObjects put ERROR: ${err}`);
    }
  }

  /**
   * Add input object to this.queue and exec this.processQueue()
   * @param {object} i - Input object
   */
  async queueUpdate(i) {
    try {
      this.queue.push(i);
      this.processQueue();
    } catch (err) {
      throw new Error(`RedisObjects queueUpdate ERROR: ${err}`);
    }
  }

  /**
   * Start system heartbeat record (1000ms loop)
   */
  startHeartBeat(interval = 1000) {
    try {
      setInterval(async () => {
        await this.client.set("redisObjectsHeartbeat", +Date.now());
      }, interval);
    } catch (err) {
      throw new Error(`RedisObjects startHeartBeat ERROR: ${err}`);
    }
  }

  /**
   * Save (or delete) object values
   * @param {object} i - Input object
   * @param {string} i.name - Object name
   * @param {string} i.path - Object path to data (x.y.z)
   * @param {*} i.value - New value or undefined
   * @param {*} i.oldValue - Old value
   * @param {int} i.ttl - TTL in seconds
   */
  async update({ name, path, value, oldValue, ttl }) {
    try {
      if (isEqual(value, oldValue)) {
        return false;
      }

      path = typeof path === "string" ? path.replaceAll(".", ":") : path;
      const [tp, tk] = this._extractFinalSegment(path);
      let deleting = false;

      if (typeof value === "undefined") {
        deleting = true;
      } else if (
        value !== null &&
        typeof value === "object" &&
        value.constructor === Object
      ) {
        if (Object.keys(value).length === 0) {
          deleting = true;
        } else {
          await this._deleteKeyPath(name, path);
          const wrk = flatten(value, { delimiter: ":", safe: true });
          for (const k in wrk) {
            const [apath, alast] = this._extractFinalSegment(k);

            await this._saveItem({
              key: `${name}${path ? ":" + path : ""}${
                apath ? ":" + apath : ""
              }`,
              item: alast,
              value: wrk[k],
              ttl,
              oldValue,
            });
          }
        }
      } else {
        await this._saveItem({
          key: tp ? `${name}:${tp}` : name,
          item: tk || path,
          value,
          ttl,
          oldValue,
        });
      }

      if (deleting) {
        await this._deleteKeyPath(name, path);
      }
      return true;
    } catch (err) {
      throw new Error(`RedisObjects update ERROR: ${err}`);
    }
  }

  /**
   * Save current heartbeat
   */
  async writeHeartBeat() {
    try {
      await this.client.set("redisObjectsHeartbeat", +Date.now());
    } catch (err) {
      this.u.e(err);
    }
  }
}
module.exports = RedisObjects;
