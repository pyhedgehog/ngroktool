#!/usr/bin/env node

var ngroksupport = require('./lib/ngroksupport');
var debuglog = ngroksupport.debuglog('ngroktool');
var ngroklocal = require('./lib/ngroklocal');
var ngrokauth = require('./lib/ngrokauth');
var ngrokcfg = require('./lib/ngrokcfg');
var ngrokstore = require('./lib/ngrokstore');
var argparse = require('argparse');
var info = require('./package.json');
var util = require('util');
var dns = require('dns');

function getParser(subHelp) {
  subHelp = subHelp===undefined?true:subHelp;
  var parser = new argparse.ArgumentParser({
    addHelp:true,
    version:info.version,
    description:info.description,
    epilog:'%(prog)s help - show help for all subcommands'
  });
  parser.addArgument(['-c', '--config'], {
    action: 'store',
    help: 'Path to config file (defaults to ~/.ngrok2/ngroktool.yml)'
  });
  parser.addArgument(['-a', '--auth'], {
    action: 'store',
    help: 'Auth synonym to use'
  });
  parser.addArgument(['-P', '--npm', '--prefix'], {
    action: 'storeTrue',
    help: 'Use prefixed output to make it parsable when run under NPM'
  });
  var subparsers = parser.addSubparsers({
    title:'subcommands',
    dest:"cmd"
  });
  var getSubparser = subparsers.addParser('get', {addHelp:subHelp, description:'Get saved account info'});
  var authSubparser = subparsers.addParser('auth', {addHelp:subHelp, description:'Add or modify saved account info'});
  authSubparser.addArgument(['-g', '--github'], {
    action: 'storeConst',
    dest: 'authtype',
    constant: 'github',
    defaultValue: null,
    help: 'Login with GitHub user'
  });
  authSubparser.addArgument(['-G', '--google'], {
    action: 'storeConst',
    dest: 'authtype',
    constant: 'google',
    defaultValue: null,
    help: 'Login with Google user (not yet implemented)' //FIXME
  });
  authSubparser.addArgument(['-N', '--ngrok'], {
    action: 'storeConst',
    dest: 'authtype',
    constant: 'ngrok',
    defaultValue: null,
    help: 'Login with Ngrok user (default)'
  });
  authSubparser.addArgument(['user'], {
    action: 'store',
    help: 'User',
    nargs: '?'
  });
  authSubparser.addArgument(['password'], {
    action: 'store',
    help: 'Password',
    nargs: '?'
  });
  var switchSubparser = subparsers.addParser('switch', {addHelp:subHelp, description:'Switch ngrok to authtoken for selected account'});
  ['tcp','http','https'].forEach(function(proto) {
    var protoSubparser = subparsers.addParser(proto, {addHelp:subHelp, description:'Search for '+proto+' tunnels'});
    protoSubparser.addArgument(['-n', '--name'], {
      action: 'store',
      defaultValue: null,
      help: 'Connection name to search'
    });
    protoSubparser.addArgument(['-H', '--host', '--hostname'], {
      action: 'store',
      defaultValue: null,
      help: 'Private host to search (usually 127.0.0.1)'
    });
    protoSubparser.addArgument(['port'], {
      action: 'store',
      help: 'Private port to search (first found if not specified)',
      defaultValue: null,
      nargs: '?'
    });
  });
  var addSubparser = subparsers.addParser('add', {addHelp:subHelp, description:'Add new tunnel'});
  addSubparser.addArgument(['-n', '--name'], {
    action: 'store',
    defaultValue: null,
    help: 'Connection name'
  });
  addSubparser.addArgument(['-d', '--subdomain'], {
    action: 'store',
    defaultValue: null,
    help: 'Connection subdomain (paid accounts only)'
  });
  addSubparser.addArgument(['-H', '--hostname'], {
    action: 'store',
    defaultValue: null,
    help: 'Connection hostname (paid accounts only)'
  });
  addSubparser.addArgument(['proto'], {
    action: 'store',
    choices: 'tcp http https'.split(' '),
    help: 'Type of new connection'
  });
  addSubparser.addArgument(['port'], {
    action: 'store',
    help: 'Private port to connect'
  });
  addSubparser.addArgument(['-r', '--raw'], {
    action: 'storeTrue',
    defaultValue: false,
    help: 'Dump raw response'
  });
  addSubparser.addArgument(['-f', '--force'], {
    action: 'storeTrue',
    defaultValue: false,
    help: "Don't check tunnel existence"
  });
  var listSubparser = subparsers.addParser('list', {addHelp:subHelp, description:'Lists all tunnels in columns format'});
  var helpSubparser = subparsers.addParser('help', {addHelp:subHelp, description:'Show help for all subcommands', help:argparse.SUPPRESS});
  var dumpSubparser = subparsers.addParser('dump', {addHelp:subHelp, description:'Dump all tunnels in JSON format'});
  dumpSubparser.addArgument(['-r', '--raw'], {
    action: 'storeConst',
    dest: 'dumptype',
    constant: 'raw',
    defaultValue: 'tunnels',
    help: 'Dump all info'
  });
  var storeGetSubparser = subparsers.addParser('store-get', {addHelp:subHelp, description:'Read current tunnels from hook.io ngrokstore service'});
  var storeSubparser = subparsers.addParser('store', {addHelp:subHelp, description:'Store current tunnels to hook.io ngrokstore service'});
  var storeDaemonSubparser = subparsers.addParser('store-daemon', {addHelp:subHelp, description:'Run a daemon that will keep up to date tunnels to hook.io ngrokstore service'});
  storeDaemonSubparser.addArgument(['-d', '--dots'], {
    action: 'storeTrue',
    dest: 'drawdots',
    constant: 'raw',
    defaultValue: false,
    help: 'Draw dots on update of data'
  });
  return parser;
}

function showtunnel(tun) {
  if(!tun.public_url&&!tun.public_uri&&!public_addr)
    return console.log(tun);
  console.log(tun.proto+'\t'+tun.private_host+(tun.private_port?':'+tun.private_port:'')+'\t'+decodeURIComponent(tun.uri?tun.uri.replace(/^\/api\/tunnels\//,''):'').replace(' ','+')+'\t'+tun.public_url);
}

function gettunnels4daemon(cb) {
  ngroklocal.gettunnels(null, function(tunnels) {
    cb(tunnels);
  }, function(err) {
    console.log('gettunnel error:', err);
    cb(null);
  });
}

function ngrokstore_update(auth,compare,cb,fb) {
  cb = cb || function() {};
  fb = fb || function(err) { console.log('ngrokstore update error:', err); };
  compare = JSON.stringify(compare);
  gettunnels4daemon(function(tunnels) {
    var stunnels = JSON.stringify(tunnels);
    if(stunnels != compare) {
      debuglog(stunnels+" != "+compare);
      ngrokstore.update(auth, stunnels, function(data) {
        if(data == "OK") {
          return cb(tunnels);
        }
        fb(data);
      }, fb);
    } else {
      debuglog("== "+compare);
    }
  });
}

function main() {
  var parser = getParser();
  var args = parser.parseArgs();
  debuglog('args =', args);

  if(args.cmd==='help') {
    var subparsers = parser._getPositionalActions()[0];
    var commands = subparsers.choices;
    //console.log(subparsers);
    parser.printHelp();
    for(var cmdName in commands) {
      if(cmdName!=='help') {
        process.stdout.write('\n');
        commands[cmdName].printHelp();
      }
    }
    return;
  }

  if(args.config) {
    ngrokcfg.setconfigpath(args.config);
  }
  delete args.config;
  var printParsable = console.log;
  if(args.npm) {
    printParsable = function(output) {
      console.log("__NGROKTOOL__:"+output);
    }
  }
  delete args.npm;

  if(args.cmd==='auth') {
    //console.log(args);
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
  } else if(args.cmd==='store-get') {
    if(!args.auth) {
      auth = ngrokcfg.gettokenauth();
    } else {
      auth = ngrokcfg.getauth(args.auth)
    }
    ngrokstore.read(auth, function(tunnels) {
      printParsable(tunnels);
    });
  } else if(args.cmd==='store') {
    if(!args.auth) {
      auth = ngrokcfg.gettokenauth();
    } else {
      auth = ngrokcfg.getauth(args.auth)
    }
    ngrokstore.addif(auth,function() {
      ngrokstore_update(auth,{},function(tunnels) {
        printParsable(/*JSON.stringify*/(tunnels));
      });
    });
  } else if(args.cmd==='store-daemon') {
    if(!args.auth) {
      auth = ngrokcfg.gettokenauth();
    } else {
      auth = ngrokcfg.getauth(args.auth)
    }
    ngrokstore.addif(auth,function(data) {
      var store = data;
      ngrokstore_update(auth,null,function(tunnels) {
        store = tunnels;
        if(args.drawdots) process.stdout.write('.');
        setInterval(function() {
          ngrokstore_update(auth,tunnels,function(tunnels) {
            if(args.drawdots) process.stdout.write('.');
            store = tunnels;
          });
        },60000);
      });
    });
  } else if(args.cmd==='get') {
    if(!args.auth) {
      ngrokcfg.enumauth(function(auth,i) {
        debuglog('auth'+i+' =', auth);
        printParsable(auth.name+':'+auth.type+':'+auth.login);
      });
    } else {
      auth = ngrokcfg.getauth(args.auth)
      debuglog('auth =', auth);
      printParsable(auth.type+':'+auth.login);
    }
  } else if(args.cmd==='switch') {
    login(args.auth);
    getraw(function(data) {
      console.log('set authtoken in ngrok.yml to '+data.tunnel_token);
      ngrokcfg.settoken(data.tunnel_token);
    });
  } else if(args.cmd==='add') {
    if(args.auth) return args.error("Can't add connection for remote ngrok instance (don't use --auth option with add command).");
    var tunargs = JSON.parse(JSON.stringify(args));
    delete tunargs.cmd;
    delete tunargs.auth;
    delete tunargs.raw;
    tunargs.addr = tunargs.port;
    delete tunargs.port;
    for(var p in tunargs) {
      if(util.isNullOrUndefined(tunargs[p]))
        delete tunargs[p];
    }
    debuglog('tunargs = '+JSON.stringify(tunargs));
    addtunnel(tunargs, args.force, function(tun) {
      if(args.raw) {
        console.log(tun);
      } else {
        showtunnel(tun);
      }
    });
  } else if(args.cmd==='list') {
    login(args.auth);
    gettunnels(function(tunnels) {
      tunnels.forEach(showtunnel);
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
    if(args.name) filters.name = args.name;
    if(args.port) filters.port = args.port;
    if(args.host) filters.host = args.host;
    findtunnels(filters, function(tunnels, alltunnels){
      if(tunnels.length>0) {
        debuglog("Found: "+JSON.stringify(tunnels,null,2));
        resolvetunnels(tunnels, function(tun) {
          if(tun.proto === 'tcp') {
            printParsable(tun.public_addr);
          } else {
            printParsable(tun.public_url);
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

function addtunnel(tunargs, force, cb, fb) {
  if(currentAuth) return args.error("Can't add connection for remote ngrok instance (don't use --auth option with add command).");
  if(force) {
    ngroklocal.addtunnel(tunargs, cb, fb);
  } else {
    var filters = {proto:tunargs.proto};
    if(!util.isNullOrUndefined(tunargs.name)) filters.name = tunargs.name;
    if(!util.isNullOrUndefined(tunargs.addr)) filters.port = tunargs.addr;
    findtunnels(filters, function(tunnels) {
      if(tunnels.length>0) {
        tunnels.forEach(cb);
      } else {
        ngroklocal.addtunnel(tunargs, cb, fb);
      }
    }, fb);
  }
}

function login(auth) {
  currentAuth = ngrokcfg.getauth(auth);
  debuglog('currentAuth =', currentAuth);
  if(auth) api = ngrokauth;
  else api = ngroklocal;
}

function listauthnames() {
  var res = [];
  ngrokcfg.enumauth(function(auth,i,arr) {
    res.push(auth.name);
    return true;
  });
  return res;
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
  if(tunnel.name && filters.name && tunnel.name !== filters.name) return false;
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
exports.addtunnel = addtunnel;
exports.setconfigpath = ngrokcfg.setconfigpath;
exports.setauth = ngrokcfg.setauth;
exports.listauthnames = listauthnames;

if(require.main === module)
  main();
