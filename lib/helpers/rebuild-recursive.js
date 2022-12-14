/**
 * Module dependencies
 */

var util = require('util');
var _ = require('@sailshq/lodash');
var getDisplayType = require('../get-display-type');


/**
 * rebuildRecursive()
 *
 * Rebuild a potentially-recursively-deep value, running
 * the specified `handleLeafTransform` lifecycle callback
 * (aka transformer function) for every primitive (i.e. string,
 * number, boolean, null, function).
 *
 * Note that this is very similar to the sanitize helper, except
 * that it does not make any assumptions about how to handle functions
 * or primitives.
 *
 * @param {Anything} val
 *
 * @param {Function} handleLeafTransform        [run AFTER stringification of Errors, Dates, etc.]
 *        @param {Anything} leafVal
 *        @param {String} leafType [either 'string', 'number', 'boolean', 'null', or 'lamda']
 *        @return {Anything} [transformed version of `leafVal`]
 *
 * @param {Function} handleCompositeTransform   [run BEFORE recursion and stripping of undefined items/props]
 *        @param {Dictionary|Array} compositeVal
 *        @param {String} leafType [either 'array' or 'dictionary']
 *        @return {Dictionary|Array} [transformed version of `compositeVal`-- MUST BE A DICTONARY OR ARRAY THAT IS SAFE TO RECURSIVELY DIVE INTO!!!]
 *
 * @returns {JSON}
 */
module.exports = function rebuildRecursive(val, handleLeafTransform, handleCompositeTransform) {
  // If an invalid transformer function was provided, throw a usage error.
  if (!_.isFunction(handleLeafTransform)){
    throw new Error('Usage: A transformer function must be provided as the second argument when rebuilding.  Instead, got: '+JSON.stringify(handleLeafTransform, null, 2));
  }

  // If `val` is undefined at the top level, leave it as `undefined`.
  if (_.isUndefined(val)) {
    return undefined;
  }

  // The only reason this outer wrapper self-calling function exists
  // is to isolate the inline function below (the cycleReplacer)
  return (function _rebuild() {
    var stack = [];
    var keys = [];

    // This was modified from @isaacs' json-stringify-safe
    // (see https://github.com/isaacs/json-stringify-safe/commit/02cfafd45f06d076ac4bf0dd28be6738a07a72f9#diff-c3fcfbed30e93682746088e2ce1a4a24)
    var cycleReplacer = function(unused, value) {
      if (stack[0] === value) { return '[Circular ~]'; }
      return '[Circular ~.' + keys.slice(0, stack.indexOf(value)).join('.') + ']';
    };

    // This is a self-invoking recursive function.
    return (function _recursiveRebuildIt (thisVal, key) {

      // Handle circle jerks
      if (stack.length > 0) {
        var self = this;
        var thisPos = stack.indexOf(self);
        ~thisPos ? stack.splice(thisPos + 1) : stack.push(self);
        ~thisPos ? keys.splice(thisPos, Infinity, key) : keys.push(key);
        if (~stack.indexOf(thisVal)) {
          thisVal = cycleReplacer.call(self, key, thisVal);
        }
      }
      else { stack.push(thisVal); }


      // If this is an array, we'll recursively rebuild and strip undefined items.
      if (_.isArray(thisVal)) {
        // But first, run the composite transform handler, if one was provided.
        if (!_.isUndefined(handleCompositeTransform)) {
          thisVal = handleCompositeTransform(thisVal, 'array');
        }
        // Now recursively rebuild and strip undefined items.
        return _.reduce(thisVal,function (memo, item, i) {
          if (!_.isUndefined(item)) {
            memo.push(_recursiveRebuildIt.call(thisVal, item, i));
          }
          return memo;
        }, []);
      }

      // Serialize errors, regexps, and dates to strings, then
      // allow those strings to be handled by the transformer
      // function from userland:
      else if (_.isError(thisVal)){
        thisVal = thisVal.stack;
        thisVal = handleLeafTransform(thisVal, 'string');
      }
      else if (_.isRegExp(thisVal)){
        thisVal = thisVal.toString();
        thisVal = handleLeafTransform(thisVal, 'string');
      }
      else if (_.isDate(thisVal)){
        thisVal = thisVal.toJSON();
        thisVal = handleLeafTransform(thisVal, 'string');
      }

      // But allow functions, strings, numbers, booleans, and `null` to
      // be handled by the transformer function provided from userland:
      else if (_.isFunction(thisVal)){
        thisVal = handleLeafTransform(thisVal, 'lamda');
      }
      else if (!_.isObject(thisVal)) {
        // There are a few special cases which are always
        // handled the same way-- these get transformed to zero,
        // then passed to the transformer function.
        // They are `NaN`, `Infinity`, `-Infinity`, and `-0`:
        if (_.isNaN(thisVal)) {
          thisVal = 0;
          thisVal = handleLeafTransform(thisVal, 'number');
        }
        else if (thisVal === Infinity) {
          thisVal = 0;
          thisVal = handleLeafTransform(thisVal, 'number');
        }
        else if (thisVal === -Infinity) {
          thisVal = 0;
          thisVal = handleLeafTransform(thisVal, 'number');
        }
        else if (thisVal === 0) {
          // (this coerces -0 to +0)
          thisVal = 0;
          thisVal = handleLeafTransform(thisVal, 'number');
        }
        // Otherwise, this is a normal primitive, so it just
        // goes through the transformer as-is, using rttc.getDisplayType()
        // to determine the second argument.
        else {
          thisVal = handleLeafTransform(thisVal, getDisplayType(thisVal));
        }
      }

      // Handle objects (which might be dictionaries and arrays,
      // or crazy things like streams):
      else if (_.isObject(thisVal)) {
        // Reject `RttcRefPlaceholders` out of hand
        // (this is a special case so there is a placeholder value that ONLY validates stricly against the "ref" type)
        // (note that like anything else, RttcRefPlaceholders nested inside of a JSON/generic dict/generic array get sanitized into JSON-compatible things)
        if (_.isObject(thisVal.constructor) && thisVal.constructor.name === 'RttcRefPlaceholder') {
          return null;
        }

        // Now we're about to take the the recursive step..!
        //
        // But first, run the composite transform handler, if one was provided.
        if (!_.isUndefined(handleCompositeTransform)) {
          thisVal = handleCompositeTransform(thisVal, 'dictionary');
        }
        // Then recursively rebuild and strip undefined keys.
        return _.reduce(_.keys(thisVal),function (memo, key) {
          var subVal = thisVal[key];
          if (!_.isUndefined(subVal)) {
            memo[key] = _recursiveRebuildIt.call(thisVal, subVal, key);
          }
          return memo;
        }, {});
      }

      // If the transformer function set the new `thisVal` to `undefined` or
      // left/set it to a function, then use `null` instead.
      // (because `null` is JSON serializable).
      if (_.isUndefined(thisVal) || _.isFunction(thisVal)) {
        thisVal = null;
      }
      // This check is just for convenience/to avoid common mistakes.
      // Note that the transformer function could have technically
      // returned a circular object that would cause an error
      // when/if stringified as JSON.  Or it might have nested undefineds,
      // functions, Dates, etc., which would cause it to look different
      // after undergoing JSON serialization.
      //
      // We do not handle these cases for performance reasons.
      // It is up to userland code to provide a reasonable transformer
      // that returns JSON serializable things.

      return thisVal;
    })(val, '');
    // ^^Note that we pass in the empty string for the top-level
    // "key" to satisfy Mr. isaac's cycle replacer
  })();
};
