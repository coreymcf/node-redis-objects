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

export class RedisObjects extends events.EventEmitter {
  constructor(props) {
    super(props);

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
}
