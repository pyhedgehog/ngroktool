var debuglog = require('./ngroksupport').debuglog('ngrokcfg');
var path = require('path');
var fs = require('fs');
var yaml = require('js-yaml');

var home = process.env.USERPROFILE || process.env.HOME;
var cfgPath = path.join(home, '.ngrok2', 'ngrok.yml');
var cfg = {ngroktool:{auth:[]}};
var watcher = null;
debuglog(cfgPath);

function _load() {
  if(fs.existsSync(cfgPath)) {
    cfg = yaml.load(fs.readFileSync(cfgPath));
    debuglog(cfg);
    if(watcher===null) {
      watcher = fs.watch(cfgPath, {persistent: false, recursive: false }, _load);
    }
  }
  if(!cfg.ngroktool) cfg.ngroktool = {auth:[]};
  if(!cfg.ngroktool.auth) cfg.ngroktool.auth = [];
  if(cfg.ngroktool.auth.length===0) cfg.ngroktool.auth.push({});
}

_load();

function _getauth(authname) {
  if(!authname) return [null, undefined];
  var auth, authno;
  auth = authno = null;
  if(!cfg.ngroktool.auth.some(function(item,i) {
    if(item.name === authname) {
      auth = item;
      authno = i;
      return true;
    }
    return false;
  })) return [{name:authname}, undefined];
  return [auth, authno];
}

function getauth(authname) {
  return _getauth(authname)[0];
}

function setauth(auth) {
  throw new Error("Not yet implemented.");
  if(!auth.name) {
  }
}

exports.getauth = getauth;
exports.setauth = setauth;
