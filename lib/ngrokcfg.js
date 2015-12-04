var ngroksupport = require('./ngroksupport');
var debuglog = ngroksupport.debuglog('ngrokcfg');
var path = require('path');
var fs = require('fs');
var url = require('url');
var util = require('util');
var yaml = require('js-yaml');

var home = process.env.USERPROFILE || process.env.HOME;
var toolCfgPath = path.join(home, '.ngrok2', 'ngroktool.yml');
var ngrokCfgPath = path.join(home, '.ngrok2', 'ngrok.yml');
var cfg = {ngrok:{}, ngroktool:{auth:[]}};
var watcher1 = null;
var watcher2 = null;
var loadLock = false;
debuglog(toolCfgPath);

function setconfigpath(cfgPath) {
  loadLock = true;
  try {
    var cfgHome, cfgPath1, cfgPath2;
    var cfgStat = fs.statSync(cfgPath);
    if(cfgStat.isDirectory()) {
      cfgHome = cfgPath;
      cfgPath1 = path.join(cfgHome, 'ngroktool.yml');
      cfgPath2 = path.join(cfgHome, 'ngrok.yml');
    } else {
      var cfg = yaml.load(fs.readFileSync(cfgPath));
      var cfgType = null;
      if(!util.isNullOrUndefined(cfg.authtoken)) cfgType = 'ngrok';
      if(util.isNullOrUndefined(cfgType)&&!util.isNullOrUndefined(cfg.tunnels)) cfgtype = 'ngrok';
      if(util.isNullOrUndefined(cfgType)&&!util.isNullOrUndefined(cfg.web_addr)) cfgtype = 'ngrok';
      if(util.isNullOrUndefined(cfgType)&&util.isArray(cfg.auth)) cfgtype = 'ngroktool';
      if(util.isNullOrUndefined(cfgType)&&('tool' in path.basename(cfgPath, path.extname(cfgPath)))) cfgtype = 'ngroktool';
      if(util.isNullOrUndefined(cfgType)) cfgtype = 'ngrok';
      cfgHome = path.dirname(cfgPath);
      if(cfgtype === 'ngroktool') {
        cfgPath1 = cfgPath;
        cfgPath2 = path.join(cfgHome, 'ngrok.yml');
      } else {
        cfgPath1 = path.join(cfgHome, 'ngroktool.yml');
        cfgPath2 = cfgPath;
      }
    }
    if(watcher1!==null) {
      watcher1.close();
      watcher1 = null;
    }
    if(watcher2!==null) {
      watcher2.close();
      watcher2 = null;
    }
    cfg = {ngrok:{}, ngroktool:{auth:[]}};
    toolCfgPath = cfgPath1;
    ngrokCfgPath = cfgPath2;
  } finally {
    loadLock = false;
  }
  _load();
}

function _load() {
  if(loadLock) return;
  if(!cfg) cfg = {ngrok:{}, ngroktool:{auth:[]}};
  if(fs.existsSync(toolCfgPath)) {
    cfg.ngroktool = yaml.load(fs.readFileSync(toolCfgPath));
    debuglog(cfg.ngroktool);
    if(watcher1===null) {
      watcher1 = fs.watch(toolCfgPath, {persistent: false, recursive: false }, _load);
    }
  }
  if(fs.existsSync(ngrokCfgPath)) {
    cfg.ngrok = yaml.load(fs.readFileSync(ngrokCfgPath));
    debuglog(cfg.ngrok);
    if(watcher2===null) {
      watcher2 = fs.watch(ngrokCfgPath, {persistent: false, recursive: false }, _load);
    }
  }
  if(!cfg.ngrok) cfg.ngrok = {};
  if(!cfg.ngroktool) cfg.ngroktool = {auth:[]};
  if(!cfg.ngroktool.auth) cfg.ngroktool.auth = [];
  //if(cfg.ngroktool.auth.length===0) cfg.ngroktool.auth.push({});
  if(cfg.ngrok.ngroktool) { // migrate from old config structure
    if(cfg.ngroktool.auth.length > 0 && cfg.ngrok.ngroktool.auth.length > 0) {
      Array.prototype.push.apply(cfg.ngroktool.auth, cfg.ngrok.ngroktool.auth);
      delete cfg.ngrok.ngroktool.auth;
    }
    cfg.ngroktool = Object.assign(cfg.ngroktool, cfg.ngrok.ngroktool);
    delete cfg.ngrok.ngroktool;
    //process.nextTick(_save);
    _save();
  }
  debuglog(cfg);
}

_load();

function _save() {
  for(var p in cfg) {
    if(p!=='ngrok' && p!=='ngroktool' && p!=='temp') {
      console.error("Unknown config option "+p+". It will not be saved.");
    }
  }
  ngroksupport.mkdirsSync(path.dirname(toolCfgPath));
  ngroksupport.mkdirsSync(path.dirname(ngrokCfgPath));
  loadLock = true;
  try {
    fs.writeFileSync(toolCfgPath, yaml.dump(cfg.ngroktool));
    fs.writeFileSync(ngrokCfgPath, yaml.dump(cfg.ngrok));
  } finally {
    loadLock = false;
  }
  _load(); // This is especially important if first _load() got non-existing config
}

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

function _setauth(auth, cb) {
  var oldauth = _getauth(auth.name);
  if(oldauth[1] !== undefined) {
    console.log("Old auth "+oldauth[1]+" overritten:\n"+jaml.dump(oldauth[0]));
    cfg.ngroktool.auth[oldauth[1]] = auth;
  } else {
    console.log("New auth added:\n"+yaml.dump(auth));
    console.log(typeof(cfg.ngroktool.auth));
    cfg.ngroktool.auth.push(auth);
  }
  _save();
  if(cb)
    cb(auth);
}

function setauth(auth, checkCB, cb) {
  //throw new Error("Not yet implemented.");
  if(!auth.name) {
    auth.name = auth.login.split('@')[0];
  }
  if(!checkCB) {
    _setauth(auth, cb);
  } else if(cb) {
    checkCB(auth, function(cb2) { _setauth(auth, cb2?cb2:cb); });
  } else {
    checkCB(auth, _setauth.bind(null, auth));
  }
}

function settoken(token, cb) {
  cfg.ngrok.authtoken = token;
  _save();
  if(cb)
    cb();
}

function getapiurl(path) {
  path = path || '/api/tunnels';
  var base = cfg.ngrok.web_addr || '127.0.0.1:4040';
  debuglog('getapiurl: base =', typeof base, base);
  if(base.indexOf('://') < 0) base = 'http://'+base;
  return url.resolve(base, path);
}

exports.getauth = getauth;
exports.setauth = setauth;
exports.settoken = settoken;
exports.getapiurl = getapiurl;
exports.setconfigpath = setconfigpath;
