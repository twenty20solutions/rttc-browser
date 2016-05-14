/**
 * Given an RTTC "display type" aka "typeclass" string,
 * return the appropriate human-readable label for that type.
 * Useful for error messages, user interfaces, etc.
 *
 *
 * @param  {String} type
 *         Recognizes any of the standard RTTC types:
 *           • string
 *           • number
 *           • boolean
 *           • lamda
 *           • dictionary
 *           • array
 *           • json
 *           • ref
 *
 * @return {String}
 */
module.exports = function getDisplayTypeLabel(type){
  if (typeof type !== 'string') {
    throw new Error('Usage error: rttc.getDisplayTypeLabel() expects a string display type such as `dictionary` or `ref`.  If you are trying to get the display type label for an exemplar, do `rttc.getDisplayTypeLabel(rttc.inferDisplayType(exemplar))`.');
  }

  if (type === 'string') {
    return 'String';
  }
  else if (type === 'number') {
    return 'Number';
  }
  else if (type === 'boolean') {
    return 'Boolean';
  }
  else if (type === 'lamda') {
    return 'Function';
  }
  else if (type === 'dictionary') {
    return 'Dictionary';
  }
  else if (type === 'array') {
    return 'Array';
  }
  else if (type === 'json') {
    return 'JSON-Compatible Value';
  }
  else if (type === 'ref') {
    return 'Anything';
  }
  else {
    throw new Error('Unknown type: `'+type+'`');
  }

};