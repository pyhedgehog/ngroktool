var ngroksupport = require('./ngroksupport')
var debuglog = ngroksupport.debuglog('ngroklocal');
var debugdata = ngroksupport.debuglog('ngrokdata');
var request = require('request');
var url = require('url');

function getraw(auth,cb,fb) {
  //debuglog(auth);
  if(auth) return ngroksupport.fbThrow(fb, new Error("No authentication data can be specified for local api."));
  //debuglog(cb,fb);
  request({uri:'http://127.0.0.1:4040/api/tunnels',proxy:false}, function(err,req,data) {
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

function gettunnels(auth,cb,fb) {
  getraw(auth,function(data) {
    if(!data.tunnels) {
      debugdata(data);
      return ngroksupport.fbThrow(fb, new Error("No tunnels in data received."));
    }
    cb(data.tunnels.map(function(tun) {
      if(tun.metrics) tun.metrics = undefined;
      if(tun.config) {
        if(tun.config.addr) {
          var uri = url.parse('tun:'+tun.config.addr);
          debugdata(uri);
          tun.private_host = uri.hostname=='localhost'?'127.0.0.1':uri.hostname;
          tun.private_port = uri.port;
        }
        tun.config = undefined;
      }
      return tun;
    }));
  },fb);
}

exports.getraw = getraw;
exports.gettunnels = gettunnels;
