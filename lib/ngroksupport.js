var util = require('util');
var fs = require('fs');
var ospath = require('path');

if(!util.debuglog) {
  util.debuglog = function(name) {
    if(!process.env.NODE_DEBUG || !(new RegExp('\\b'+name+'\\b')).test(process.env.NODE_DEBUG)) return function(){};
    return function() {
      console.log.apply(undefined, arguments);
    };
  }
}

if(!fs.mkdirs) {
  fs.mkdirs = mkdirs = function mkdirs(path, mode, cb) {
    if (typeof mode === 'function') { cb = mode; mode = undefined; }
    if(fs.existsSync(path)) return cb();
    mkdirs(ospath.dirname(path), mode, function() {
      fs.mkdir(path, mode, cb);
    });
  }
}

if(!fs.mkdirsSync) {
  fs.mkdirsSync = mkdirsSync = function mkdirsSync(path, mode) {
    if(fs.existsSync(path)) return;
    mkdirsSync(ospath.dirname(path), mode);
    fs.mkdirSync(path, mode);
  }
}

if(!Object.assign) {
  Object.defineProperty(Object, 'assign', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function assign(target) {
      'use strict';
      if(target === undefined || target === null) {
        throw new TypeError('Cannot convert first argument to object');
      }

      var to = Object(target);
      for(var i = 1; i < arguments.length; i++) {
        var nextSource = arguments[i];
        if(nextSource === undefined || nextSource === null) {
          continue;
        }
        nextSource = Object(nextSource);

        var keysArray = Object.keys(Object(nextSource));
        for(var nextIndex = 0, len = keysArray.length; nextIndex < len; nextIndex++) {
          var nextKey = keysArray[nextIndex];
          var desc = Object.getOwnPropertyDescriptor(nextSource, nextKey);
          if(desc !== undefined && desc.enumerable) {
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
exports.mkdirs = fs.mkdirs;
exports.mkdirsSync = fs.mkdirsSync;
