var ngroksupport = require('./ngroksupport');
var debuglog = ngroksupport.debuglog('ngrokstore');
var ngrokcfg = require('./ngrokcfg');
var request = require('request');
var crypto = require('crypto');

function _process(action,args,cb,fb) {
  var opts = ngrokcfg.getngrokstore(action, args);
  debuglog(opts);
  request(opts, function(err,req,data) {
    if(err) {
      debuglog("error: ", err);
    } else {
      //debuglog(req);
      debuglog("data: ", data);
      if(data.substr(0,1) == "!") {
        return ngroksupport.fbThrow(fb, new Error(data.substr(1)));
      }
      try {
        data = JSON.parse(data);
      } catch(e) {
        err = data;
      }
    }
    if(err) {
      return ngroksupport.fbThrow(fb, err);
    }
    cb(data);
  });
}

function read(auth,cb,fb) {
  var hash = crypto.createHash('sha256');
  hash.update(auth.login+':'+auth.authtoken);
  return _process('read',{"access": hash.digest('hex')},cb,fb);
}

function update(auth,tunnels,cb,fb) {
  var hash = crypto.createHash('sha256');
  hash.update(auth.login+':'+auth.authtoken);
  return _process('update',{"access": hash.digest('hex'),"payload": tunnels},cb,fb);
}

function add(auth,cb,fb) {
  return _process('add',{"id":auth.login,"key":auth.authtoken},cb,fb);
}

function addif(auth,cb,fb) {
  cb = cb || function() {};
  return read(auth,cb,function() {
    add(auth,function() {cb({});},fb);
  });
}

exports.read = read;
exports.update = update;
exports.add = add;
exports.addif = addif;
