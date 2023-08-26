/**
 *  Redis Objects - Storage Interface for Javascript Objects
 *  @module redis-objects
 *  @license MIT
 *  @author Corey S. McFadden <coreymcf@gmail.com>
 */
import { Redis } from "ioredis";
import events from "events";
import flatten from "flat";
import isEqual from "lodash/isEqual.js";
import { getValueType, isJSON } from "./utls.mjs";

export class RedisObjects extends events.EventEmitter {
  constructor(props) {
    super(props);

    this.storagePath = props?.storagePath ? props.storagePath + ":" : false;

    this.queue = []; // Update queue
    this.queueLock = false; // Update lock

    // Connect to ioRedis
    this._connect();
  }

  /**
   * Connect to ioRedis and manage connection
   */
  _connect() {
    // ioRedis Client
    this.client = props?.redis
      ? props.redis
      : props?.ioRedisOptions
      ? new Redis(props.ioRedisOptions)
      : new Redis();

    this.client.on("connect", () => {
      this.emit("connect", `RedisObjects connected to Redis.`);
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
  async _saveItem({ key, item, value, ttl = false }) {
    try {
      const redis = this.client;
      let type = getValueType(value);

      const fullKey = item ? `${key}:${item}` : key;
      const metaKey = `${fullKey}.meta`;
      let setMeta = false;

      // Type checking
      switch (type) {
        case "string":
        case "number":
          if (item) {
            await redis.hset(key, item, value);
          } else {
            await redis.set(key, value);
          }
          break;

        case "date":
        case "raw":
        case "json":
        case "boolean":
          await redis.set(
            metaKey,
            JSON.stringify({ type: type === "json" ? "raw" : type })
          );
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

        case "null":
        case "map":
        case "function":
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
   * Flush cache (delete all)
   * @returns Promise
   */
  async flushAll() {
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
  async getObject(path) {
    return new Promise(async (resolve) => {
      try {
        const redis = this.client;
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
                    case "date":
                      d[k] = new Date(Number(d[k]));
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
                    case "function":
                      const func = JSON.parse(d[k]);
                      const fax = func.match(/\(([^)]*)\)/);
                      const fArgs = fax
                        ? fax[1].split(",").map((arg) => arg.trim())
                        : [];
                      const fBody = (func.match(/(?<={)([\s\S]*)(?=})/) || [
                        "",
                      ])[0];
                      d[k] = new Function(...fArgs, fBody);
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
                `RedisObjects getObject ERROR: Unmatched type '${type}'.`
              );
          }
        }

        resolve(workingObject[path] || {});
      } catch (err) {
        throw new Error(`RedisObjects getObject ERROR: ${err}`);
      }
    });
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
      return await this.updateObject({
        path: false, // Not needed for root-level storage
        value,
        key: name,
        oldValue: false, // Always save
        ttl,
      });
    } catch (err) {
      throw new Error(`RedisObjects put ERROR: ${err}`);
    }
  }

  /**
   * Save (or delete) object values
   * @param {object} i - Input object
   * @param {string} i.path - Object path to data (x.y.z)
   * @param {*} i.value - New value or undefined
   * @param {string} i.key - Object name
   * @param {*} i.oldValue - Old value
   * @param {int} i.ttl - TTL in seconds
   */
  async updateObject({ path, value, key, oldValue, ttl }) {
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
          await this._deleteKeyPath(key, path);
          const wrk = flatten(value, { delimiter: ":", safe: true });
          for (const k in wrk) {
            const [apath, alast] = this._extractFinalSegment(k);
            await this._saveItem({
              key: `${key}${path ? ":" + path : ""}${apath ? ":" + apath : ""}`,
              item: alast,
              value: wrk[k],
              ttl,
            });
          }
        }
      } else {
        await this._saveItem({
          key: tp ? `${key}:${tp}` : key,
          item: tk || path,
          value,
          ttl,
        });
      }

      if (deleting) {
        await this._deleteKeyPath(key, path);
      }
      return true;
    } catch (err) {
      throw new Error(`RedisObjects updateObject ERROR: ${err}`);
    }
  }
}
