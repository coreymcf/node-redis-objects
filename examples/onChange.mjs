import onChange from "on-change";
import RedisObjects from "../index.js";

const redisObjects = new RedisObjects();
const object = {
  foo: false,
  a: {
    b: [
      {
        c: false,
      },
    ],
  },
};

const watchedObject = onChange(object, function (path, value, oldValue) {
  redisObjects.queueUpdate({
    path,
    value,
    name: `object`,
    oldValue,
    ttl: false,
  });
});

watchedObject.foo = true;
watchedObject.a.b[0].c = true;

setTimeout(() => {
  console.log(JSON.stringify(watchedObject, null, "\t"));
  redisObjects.close();
}, 500);
