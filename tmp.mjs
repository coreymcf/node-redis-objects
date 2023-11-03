import onChange from "on-change";

const xobject = {
  key1: "1234",
  key2: {
    a: "key2 a string",
    b: false,
  },
};

let index = 0;
const watchedObject = onChange(
  xobject,
  function (path, value, oldValue, applyData) {
    console.log({
      name: `xobject`,
      path,
      value,
      oldValue,
      ttl: false,
    });
  }
);

watchedObject.key1 = "9876";
watchedObject.key2.b = "9876";
