/**
 * Module dependencies
 */

var util = require('util');
var _ = require('lodash');
var rttc = require('../../');



module.exports = function testCoercion(expectations, cb){


  // Determine type schema of the value.
  // (using inference to pull it from the `example`, if provided)
  var typeSchema;
  if (!_.isUndefined(expectations.type) && !_.isUndefined(expectations.example)) {
    return cb (new Error('invalid test: cannot specify both `type` and `example`'));
  }
  else if (!_.isUndefined(expectations.type)) {
    typeSchema = expectations.type;
  }
  else if (!_.isUndefined(expectations.example)) {
    typeSchema = rttc.infer(expectations.example);
  }


  // Now coerce the actual value using the type schema.
  var coerced;
  var gotError;
  try {
    coerced = rttc.coerce(typeSchema, expectations.actual);
  }
  catch (e) {
    gotError = e;
  }


  // Handle case where we got an unexpected error.
  if (gotError) {
    return cb(new Error('did not expect coercion error, but got one:\n' + util.inspect(gotError)));
  }

  // TODO: remove this hack.
  if (_.isUndefined(expectations.result)) return cb();

  // Ensure that the actual result matches the test's expectations.
  if (_.isEqual(coerced, expectations.result)) {
    return cb();
  }
  return cb(new Error('.coerce() returned incorrect value: '+util.inspect(coerced, false, null)));

};