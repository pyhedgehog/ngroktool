var ngroksupport = require('./lib/ngroksupport')
var debuglog = ngroksupport.debuglog('ngroktool');
var ngroklocal = require('./lib/ngroklocal');
var ngrokauth = require('./lib/ngrokauth');
var ngrokcfg = require('./lib/ngrokcfg');
var argparse = require('argparse');
var info = require('./package.json');
var util = require('util');
var dns = require('dns');

function getParser() {
  var parser = new argparse.ArgumentParser({
    addHelp:true,
    version:info.version,
    description:info.description
  });
  parser.addArgument(['-a', '--auth'], {
    action: 'store',
    help: 'Auth synonym to use'
  });
  var subparsers = parser.addSubparsers({
    title:'subcommands',
    dest:"cmd"
  });
  var authParser = subparsers.addParser('auth', {addHelp:true});
  authParser.addArgument(['-g', '--github'], {
    action: 'storeConst',
    dest: 'authtype',
    constant: 'github',
    defaultValue: 'ngrok',
    help: 'Login with GitHub user'
  });
  authParser.addArgument(['user'], {
    action: 'store',
    help: 'User',
    nargs: '?'
  });
  authParser.addArgument(['password'], {
    action: 'store',
    help: 'Password',
    nargs: '?'
  });
  var swParser = subparsers.addParser('switch', {addHelp:true});
  ['tcp','http','https'].forEach(function(proto) {
    var subParser = subparsers.addParser(proto, {addHelp:true});
    subParser.addArgument(['port'], {
      action: 'store',
      help: 'Private port to search (first found if not specified)',
      defaultValue: null,
      nargs: '?'
    });
  });
  var listParser = subparsers.addParser('list', {addHelp:true});
  var dumpParser = subparsers.addParser('dump', {addHelp:true});
  dumpParser.addArgument(['-r', '--raw'], {
    action: 'storeConst',
    dest: 'dumptype',
    constant: 'raw',
    defaultValue: 'tunnels',
    help: 'Dump all info'
  });
  return parser;
}

function main() {
  var parser = getParser();
  var args = parser.parseArgs();
  debuglog('args =', args);

  if(args.cmd==='auth') {
    console.log(args);
    ngrokcfg.setauth({name:args.auth, login:args.user, password:args.password, type:args.authtype}, function(auth, cb) {
      ngrokauth.getraw(auth, function(data) {
        console.log('check-getraw =', data);
        auth.authtoken = data.tunnel_token;
        cb(function(auth) {
          login(auth);
          console.log('setauth =', auth);
        });
      });
    });
  } else if(args.cmd==='switch') {
    login(args.auth);
    getraw(function(data) {
      console.log('set authtoken in ngrok.yml to '+data.tunnel_token);
      ngrokcfg.settoken(data.tunnel_token);
    });
  } else if(args.cmd==='list') {
    login(args.auth);
    gettunnels(function(tunnels) {
      tunnels.forEach(function(tun) {
        console.log(tun.proto+'\t'+tun.private_host+(tun.private_port?':'+tun.private_port:'')+'\t'+decodeURIComponent(tun.uri?tun.uri.replace(/^\/api\/tunnels\//,''):'').replace(' ','+')+'\t'+tun.public_url);
      });
    });
  } else if(args.cmd==='dump') {
    login(args.auth);
    if(args.dumptype == 'raw') {
      getraw(dumpCB);
    } else {
      gettunnels(dumpCB);
    }
    function dumpCB(data) {
      console.log(JSON.stringify(data, null, 2));
    }
  } else if((args.cmd==='tcp')||(args.cmd==='http')||(args.cmd==='https')) {
    login(args.auth);
    var filters = {proto:args.cmd};
    if(args.port) filters.port = args.port;
    if(args.host) filters.host = args.host;
    findtunnels(filters, function(tunnels, alltunnels){
      if(tunnels.length>0) {
        debuglog("Found: "+JSON.stringify(tunnels,null,2));
        resolvetunnels(tunnels, function(tun) {
          if(tun.proto === 'tcp') {
            console.log(tun.public_addr);
          } else {
            console.log(tun.public_url);
          }
        });
      } else {
        debuglog("Can't find "+filters+": "+JSON.stringify(alltunnels,null,2));
        process.exitCode = 1;
      }
    });
  } else {
    console.error("Invalid command", args.cmd);
    process.exitCode = 2;
  }
}

var currentAuth = null, api = ngroklocal;

function login(auth) {
  currentAuth = ngrokcfg.getauth(auth);
  debuglog('currentAuth =', currentAuth);
  if(auth) api = ngrokauth;
  else api = ngroklocal;
}

function getraw(cb, fb) {
  return api.getraw(currentAuth, cb, fb);
}

function gettunnels(cb, fb) {
  return api.gettunnels(currentAuth, cb, fb);
}

function findtunnels(filters, cb, fb) {
  return gettunnels(function(alltunnels) {
    var tunnels = alltunnels.filter(function(tun) {
      return filtertunnel(tun, filters);
    });
    cb(tunnels, alltunnels);
  }, fb);
}

function filtertunnel(tunnel, filters) {
  if(tunnel.proto !== filters.proto) return false;
  if(tunnel.private_host && filters.host && tunnel.private_host !== filters.host) return false;
  if(tunnel.private_port && filters.port && tunnel.private_port !== filters.port) return false;
  return true;
}

function resolvetunnels(tunnels, cb, fb) {
  tunnels.forEach(function(tun) {
    if(tun.proto !== 'tcp') return cb(tun);
    var found = tun.public_url.match(/^tcp:\/\/([^:]*|\[[^\]]*\]):([0-9]+)$/i);
    if(!found) {
      return ngroksupport.fbThrow(fb, new Error("Can't parse urls "+tun.public_url));
    }
    var host = found[1];
    if(host.charAt(0) == '[') host = host.substr(1,host.length-2);
    var port = found[2];
    if('0'<=host.charAt(0)&&host.charAt(0)<='9') {
      dns.resolve(host,function(err,addresses){if(err||!addresses) return final(tun,host,port); final(tun,addresses[0],port);});
    } else {
      final(host,port);
    }
  });
  function final(tun, host, port) {
    tun.public_host = host;
    tun.public_port = port;
    if(host.indexOf(':') !== -1) host = '['+host+']';
    tun.public_addr = host+':'+tun.public_port;
    cb(tun);
  }
}

exports.login = login;
exports.getraw = getraw;
exports.gettunnels = gettunnels;
exports.findtunnels = findtunnels;
exports.resolvetunnels = resolvetunnels;

if(require.main === module)
  main();
