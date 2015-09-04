var util = require('util');

if(!util.debuglog) {
  util.debuglog = function(name) {
    if(!process.env.NODE_DEBUG || !(new RegExp('\\b'+name+'\\b')).test(process.env.NODE_DEBUG)) return function(){};
    return function() {
      console.log.apply(undefined, arguments);
    };
  }
}

if (!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function(target) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object');
      }

      var to = Object(target);
      for (var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if (nextSource === undefined || nextSource === null) {
          continue;
        }
        nextSource = Object(nextSource);

        var keysArray = Object.keys(Object(nextSource));
        for (var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex];
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if (desc !== undefined && desc.enumerable) {
            to[nextKey] = nextSource[nextKey];
          }
        }
      }
      return to;
    }
  });
}

function fbThrow(fb, error) {
  if(fb) {
    return fb(error);
  }
  throw error;
}

exports.debuglog = util.debuglog;
exports.fbThrow = fbThrow;
