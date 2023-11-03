const assert = require("chai").assert;
const should = require("should");
const RedisObjects = require("../index.js");

describe("RedisObjects", function () {
  // Non storagePath

  describe("Root Level (no storagePath) Tests", function () {
    const redisObjects = new RedisObjects({ storagePath: "" });

    describe("ping()", function () {
      it("Should return a PONG", async function () {
        assert.deepEqual(
          await redisObjects.ping(),
          "PONG",
          "Ping did not return result."
        );
      });
    });

    describe("flushall()", function () {
      it("should clear Redis (clean slate for testing)", async function () {
        await redisObjects.flushall();
        const redisDbSize = await redisObjects.call("dbsize");
        redisDbSize.should.equal(0);
      });
    });

    describe("put() and get() - Basic object", function () {
      it("should set an object and then retrieve it", async function () {
        const testObject = {
          key: "testValue",
          a: "aaa",
          b: "bbb",
        };
        await redisObjects.put("testObject", testObject);

        const retrievedObject = await redisObjects.get("testObject");

        assert.isObject(retrievedObject, "Result is not an object");
        assert.deepEqual(
          retrievedObject,
          testObject,
          "Retrieved object does not match the test object"
        );
      });
    });

    describe("put() and get() - w/ complex data structures.", function () {
      it("should set an object and then retrieve it", async function () {
        const complexObject = {
          booleanTest: false,
          nullTest: null,
          stringTest: "aString",
          numberTest: 123456789,
          dateNumberTest: Date.now(),
          dateObjectTest: new Date(),
          nest: {
            a: "12345",
            b: false,
          },
          arrayTest: [1, 2, 3, 4, "a", "b", "c"],
          arrayObjectTest: [{ a: 1 }, { b: 2 }, { a: 3 }, { b: 2 }],
          mapTest: new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
          ]),
          setTest: new Set(["one", "one", "two", "three"]),
          jsonTest: JSON.stringify({ a: "12345", b: 12345 }),
        };

        await redisObjects.put("complexObject", complexObject);
        const retrievedObject = await redisObjects.get("complexObject");

        assert.isObject(retrievedObject, "Result is not an object");
        assert.deepEqual(
          retrievedObject,
          complexObject,
          "Retrieved object does not match the test object"
        );
      });
    });

    describe("put() and get() - w/ functions.", function () {
      it("functions should match on string level", async function () {
        const funcObj = {
          functionTest: (param, param2) => {
            return param + param2;
          },
          oldfunctionTest: function (param, param2) {
            return param + param2;
          },
        };

        await redisObjects.put("funcObj", funcObj);
        const retrievedObject = await redisObjects.get("funcObj");

        retrievedObject.functionTest
          .toString()
          .should.equal(funcObj.functionTest.toString());

        retrievedObject.oldfunctionTest
          .toString()
          .should.equal(funcObj.oldfunctionTest.toString());
      });
    });

    describe("update() - change an item in complexObject.", function () {
      it("nest.a key value should match", async function () {
        await redisObjects.update({
          name: `complexObject`,
          path: `nest.b`,
          value: "A new string",
          oldValue: false,
          ttl: false,
        });

        const retrievedObject = await redisObjects.get("complexObject");
        retrievedObject.nest.b.should.equal("A new string");
      });
    });

    describe("queueUpdate() - change an item in complexObject.", function () {
      it("nest.a key value should match", async function () {
        await redisObjects.queueUpdate({
          name: `complexObject`,
          path: `nest.a`,
          value: "A new string",
          oldValue: false,
          ttl: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));

        const retrievedObject = await redisObjects.get("complexObject");
        retrievedObject.nest.a.should.equal("A new string");
      });
    });

    describe("flushall()", function () {
      it("should clear Redis (clean slate post-testing)", async function () {
        await redisObjects.flushall();
        const redisDbSize = await redisObjects.call("dbsize");
        redisDbSize.should.equal(0);
      });
    });

    after("Closing Redis connection.", () => {
      redisObjects.close();
    });
  });

  describe("storagePath Tests", function () {
    const redisObjects = new RedisObjects({ storagePath: "storagePath" });

    describe("ping()", function () {
      it("Should return a PONG", async function () {
        assert.deepEqual(
          await redisObjects.ping(),
          "PONG",
          "Ping did not return result."
        );
      });
    });

    describe("flushall()", function () {
      it("should clear Redis (clean slate for testing)", async function () {
        await redisObjects.flushall();
        const redisDbSize = await redisObjects.call("dbsize");
        redisDbSize.should.equal(0);
      });
    });

    describe("put() and get() - Basic object", function () {
      it("should set an object and then retrieve it", async function () {
        const testObject = {
          key: "testValue",
          a: "aaa",
          b: "bbb",
        };
        await redisObjects.put("testObject", testObject);

        const retrievedObject = await redisObjects.get("testObject");

        assert.isObject(retrievedObject, "Result is not an object");
        assert.deepEqual(
          retrievedObject,
          testObject,
          "Retrieved object does not match the test object"
        );
      });
    });

    describe("put() and get() - w/ complex data structures.", function () {
      it("should set an object and then retrieve it", async function () {
        const complexObject = {
          booleanTest: false,
          nullTest: null,
          stringTest: "aString",
          numberTest: 123456789,
          dateNumberTest: Date.now(),
          dateObjectTest: new Date(),
          nest: {
            a: "12345",
            b: false,
          },
          arrayTest: [1, 2, 3, 4, "a", "b", "c"],
          arrayObjectTest: [{ a: 1 }, { b: 2 }, { a: 3 }, { b: 2 }],
          mapTest: new Map([
            ["a", 1],
            ["b", 2],
            ["c", 3],
          ]),
          setTest: new Set(["one", "one", "two", "three"]),
          jsonTest: JSON.stringify({ a: "12345", b: 12345 }),
        };

        await redisObjects.put("complexObject", complexObject);
        const retrievedObject = await redisObjects.get("complexObject");

        assert.isObject(retrievedObject, "Result is not an object");
        assert.deepEqual(
          retrievedObject,
          complexObject,
          "Retrieved object does not match the test object"
        );
      });
    });

    describe("put() and get() - w/ functions.", function () {
      it("functions should match on string level", async function () {
        const funcObj = {
          functionTest: (param, param2) => {
            return param + param2;
          },
          oldfunctionTest: function (param, param2) {
            return param + param2;
          },
        };

        await redisObjects.put("funcObj", funcObj);
        const retrievedObject = await redisObjects.get("funcObj");

        retrievedObject.functionTest
          .toString()
          .should.equal(funcObj.functionTest.toString());

        retrievedObject.oldfunctionTest
          .toString()
          .should.equal(funcObj.oldfunctionTest.toString());
      });
    });

    describe("update() - change an item in complexObject.", function () {
      it("nest.a key value should match", async function () {
        await redisObjects.update({
          name: `complexObject`,
          path: `nest.b`,
          value: "A new string",
          oldValue: false,
          ttl: false,
        });

        const retrievedObject = await redisObjects.get("complexObject");
        retrievedObject.nest.b.should.equal("A new string");
      });
    });

    describe("queueUpdate() - change an item in complexObject.", function () {
      it("nest.a key value should match", async function () {
        await redisObjects.queueUpdate({
          name: `complexObject`,
          path: `nest.a`,
          value: "A new string",
          oldValue: false,
          ttl: false,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));

        const retrievedObject = await redisObjects.get("complexObject");
        retrievedObject.nest.a.should.equal("A new string");
      });
    });

    describe("flushall()", function () {
      it("should clear Redis (clean slate post-testing)", async function () {
        await redisObjects.flushall();
        const redisDbSize = await redisObjects.call("dbsize");
        redisDbSize.should.equal(0);
      });
    });

    after("Closing Redis connection.", () => {
      redisObjects.close();
    });
  });
});
