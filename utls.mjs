/**
 *  Redis Objects - Utils
 *  @module redis-objects
 *  @license MIT
 *  @author Corey S. McFadden <coreymcf@gmail.com>
 */

/**
 * Test input value for data type
 * @param {*} value - Input value
 * @returns String - Type
 */
export const getValueType = (value) => {
  const type = typeof value;
  return value === null
    ? "null"
    : Array.isArray(value)
    ? "array"
    : value instanceof Map
    ? "map"
    : value instanceof Set
    ? "set"
    : value instanceof Date
    ? "date"
    : type === "string" && this.isJSON(value)
    ? "json"
    : type;
};

/**
 * Identify a string as containing a JSON object
 * @param {string} str
 * @returns
 */
export const isJSON = (str) => {
  try {
    if (typeof str !== "string") return false;
    const obj = JSON.parse(str);
    return typeof obj === "object" && obj !== null;
  } catch (e) {
    return false;
  }
};
