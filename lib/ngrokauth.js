var ngroksupport = require('./ngroksupport')
var debuglog = ngroksupport.debuglog('ngrokauth');
var debugdata = ngroksupport.debuglog('ngrokdata');
var url = require('url');
var dns = require('dns');
var util = require('util');
var request = require('request')
var cheerio = require('cheerio')

var cookies = request.jar();
var opts = {jar: cookies};
//if(process.env.http_proxy)
//  opts.proxy = process.env.http_proxy;
//debuglog('opts =', opts);

request = request.defaults(opts);

var ngrok_github_uri = 'https://dashboard.ngrok.com/user/github/login';
var github_login_uri = 'https://github.com/session';
var ngrok_login_uri = 'https://dashboard.ngrok.com/user/login';
var ngrok_uri = 'https://dashboard.ngrok.com/';

function login_github(auth, cb, fb) {
  request(ngrok_github_uri, function(error, response, body) {
    debuglog(ngrok_github_uri);
    if(error) return ngroksupport.fbThrow(fb, error);
    if(response.statusCode != 200) return ngroksupport.fbThrow(fb, new Error(response.statusMessage));
    var $ = cheerio.load(body);
    var token = $('.auth-form form input[name="authenticity_token"]');
    if(!token) return ngroksupport.fbThrow(fb, new Error("Can't find authenticity_token."));
    token = token.val();
    debuglog('authtoken =', token);
    var return_to = $('#return_to');
    if(!return_to) return ngroksupport.fbThrow(fb, new Error("Can't find return_to."));
    return_to = return_to.val();
    debuglog('return_to =', return_to);
    $ = undefined;
    request({method:"POST", uri:github_login_uri, form: {authenticity_token:token, login:auth.login, password:auth.password, return_to:return_to}}, function(error, response, body) {
      debuglog(github_login_uri);
      if(error) return ngroksupport.fbThrow(fb, error);
      debuglog(response.headers.location);
      if(response.statusCode != 302) return ngroksupport.fbThrow(fb, new Error('https://github.com/session: '+response.statusMessage));
      if(!response.headers.location || !/^https:\/\/github\.com\/login\/oauth\/authorize/.test(response.headers.location))
        return ngroksupport.fbThrow(fb, new Error("github login sequence error 39."));
      var ghurl = response.headers.location;
      request(ghurl, function(error, response, body) {
        debuglog('https://dashboard.ngrok.com/');
        if(error) return ngroksupport.fbThrow(fb, error);
        debuglog(response.headers);
        debuglog(body);
        var $ = cheerio.load(body);
        var data = $('#preloaded');
        if(!data) return ngroksupport.fbThrow(fb, new Error("Can't find data."));
        data = data.data('value');
        cb(data);
      });
    });
  });
}

function login_ngrok(auth, cb, fb) {
  request(ngrok_login_uri, function(error, response, body) {
    debuglog(ngrok_login_uri, '[GET]');
    debugdata('body =', body);
    debuglog('status =', response.statusCode, response.statusMessage);
    debuglog('headers =', response.headers);
    if(error) return ngroksupport.fbThrow(fb, error);
    if(response.statusCode != 200) return ngroksupport.fbThrow(fb, new Error(response.statusMessage));
    var $ = cheerio.load(body);
    var token = $('form input[name="csrf_token"]');
    if(!token) return ngroksupport.fbThrow(fb, new Error("Can't find csrf_token."));
    token = token.val();
    debuglog('authtoken =', token);
    $ = undefined;
    request({method:"POST", uri:ngrok_login_uri, form: {csrf_token:token, email:auth.login, password:auth.password}, headers:{referer:ngrok_login_uri}}, function(error, response, body) {
      debuglog(ngrok_login_uri, '[POST]');
      if(error) return ngroksupport.fbThrow(fb, error);
      debuglog('reqbody =', response.request.body.toString());
      debuglog('status =', response.statusCode, response.statusMessage);
      debuglog('headers =', response.headers);
      if(response.statusCode != 302) {
        debugdata('body =', body);
        return ngroksupport.fbThrow(fb, new Error(response.location+': '+response.statusCode+' '+response.statusMessage));
      }
      if(!response.headers.location || !/^https?:\/\/dashboard\.ngrok\.com/.test(response.headers.location))
        return ngroksupport.fbThrow(fb, new Error("ngrok login sequence error 74."));
      request(ngrok_uri, function(error, response, body) {
        debuglog(ngrok_uri);
        if(error) return ngroksupport.fbThrow(fb, error);
        if(response.statusCode != 200) return ngroksupport.fbThrow(fb, new Error(response.statusMessage));
        debuglog('headers =', response.headers);
        debugdata('body =', body);
        var $ = cheerio.load(body);
        var data = $('#preloaded');
        if(!data) return ngroksupport.fbThrow(fb, new Error("Can't find data."));
        data = data.data('value');
        cb(data);
      });
    });
  });
}

function login(auth, cb, fb) {
  debuglog(auth);
  if(!auth) return ngroksupport.fbThrow(fb, new Error("No authentication data specified - use local api."));
  if(auth.type == 'github') return login_github(auth, cb, fb);
  if(auth.type == 'ngrok') return login_ngrok(auth, cb, fb);
  return ngroksupport.fbThrow(fb, new Error("Unknow login type "+util.inspect(auth.type)+"."));
}

function getraw(auth, cb, fb) {
  //debuglog(cb, fb);
  login(auth, cb, fb);
}

function gettunnels(auth, cb, fb) {
  //debuglog(cb, fb);
  getraw(auth, function(data) {
    if(!data.online_tunnels) {
      debugdata(data);
      return ngroksupport.fbThrow(fb, new Error("No online_tunnels in data received."));
    }
    cb(data.online_tunnels.map(function(tun) {
      var uri = url.parse(tun.url);
      debugdata(uri);
      return {proto:uri.protocol.replace(/:$/g, ''), public_url:tun.url, private_host:tun.remote_addr};
    }));
  }, fb);
}

exports.getraw = getraw;
exports.gettunnels = gettunnels;
