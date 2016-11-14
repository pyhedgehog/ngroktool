var ngroksupport = require('./ngroksupport');
var debuglog = ngroksupport.debuglog('ngroklocal');
var debugdata = ngroksupport.debuglog('ngrokdata');
var ngrokcfg = require('./ngrokcfg');
var request = require('request');
var url = require('url');

function getraw(auth,cb,fb) {
  //debuglog(auth);
  if(auth) return ngroksupport.fbThrow(fb, new Error("No authentication data can be specified for local api."));
  //debuglog(cb,fb);
  request({uri:ngrokcfg.getapiurl('/api/tunnels'),proxy:false}, function(err,req,data) {
    if(err) {
      debuglog(err);
    } else {
      //debuglog(req);
      debuglog(data);
      try {
        data = JSON.parse(data);
      } catch(e) {
        err = e;
      }
    }
    if(err) {
      if(fb) fb(err);
      return;
    }
    cb(data);
  });
}

function converttunneldata(tun) {
  if(tun.metrics) delete tun.metrics;
  if(tun.config) {
    if(tun.config.addr) {
      var uri = url.parse('tun:'+tun.config.addr);
      debugdata(uri);
      tun.private_host = uri.hostname=='localhost'?'127.0.0.1':uri.hostname;
      tun.private_port = uri.port;
    }
    delete tun.config;
  }
  return tun;
}

function gettunnels(auth,cb,fb) {
  getraw(auth,function(data) {
    if(!data.tunnels) {
      debugdata(data);
      return ngroksupport.fbThrow(fb, new Error("No tunnels in data received."));
    }
    cb(data.tunnels.map(converttunneldata));
  },fb);
}

function addtunnel(tunargs,cb,fb) {
  request({method:'POST',uri:ngrokcfg.getapiurl('/api/tunnels'),proxy:false,headers:{'content-type':'application/json'},body:JSON.stringify(tunargs)}, function(err,req,data) {
    if(err) {
      debuglog(err);
    } else {
      //debuglog(req);
      debuglog(data);
      try {
        data = JSON.parse(data);
      } catch(e) {
        err = e;
      }
    }
    if(err) {
      if(fb) fb(err);
      return;
    }
    cb(converttunneldata(data));
  });
}

exports.getraw = getraw;
exports.gettunnels = gettunnels;
exports.addtunnel = addtunnel;
