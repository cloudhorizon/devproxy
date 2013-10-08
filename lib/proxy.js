#!/usr/bin/env node 

var httpProxy = require('http-proxy');
var HTTPServer = require('http-server').HTTPServer;
var util = require('util');
var fs = require('fs');
var url = require('url');
var opts = require('optimist');

// DEFAULT_STATIC_DIR
//
// Default directory from which to serve static files.
//
var DEFAULT_STATIC_DIR = 'www';

// DEFAULT_TARGET
//
// The default target which we want to proxy.
//
var DEFAULT_TARGET = 'http://localhost:9000/api';

// DEFAULT_ROOT_PATH
//
// The default local path on which the proxied server will be available at.
// When set to a falsy value, it will mathch the path portion of the
// `DEFAULT_TARGET`.
//
var DEFAULT_ROOT_PATH = null;

// DEFAULT_PORT
//
// Port on which the proxy server will listen. Default is `8080`.
//
var DEFAULT_PORT = 8080;

// DEFAULT_NO_LANG
//
// This option disables the sending of 'Acccept-Language' header. This is done
// to prevent redirects on a buggy API host. If your endpoint returns redirects
// instead of data, try setting this option to `true`.
//
var DEFAULT_NO_LANG = false;

// Command line options
argv = opts.usage([
  'Usage:',
  '    $0 [-c] FILE',
  '    $0 [-p PORT] [-t TARGET] [-r ROOT_URL] [-s STATIC_DIR] [-n]',
  ''
].join('\n')).
  default('p', DEFAULT_PORT).
  default('t', DEFAULT_TARGET).
  default('r', DEFAULT_ROOT_PATH).
  default('s', DEFAULT_STATIC_DIR).
  alias('p', 'port').
  alias('t', 'target').
  alias('r', 'url').
  alias('s', 'static').
  alias('n', 'no-lang').
  alias('h', 'help').
  describe('c', 'Use configuration file FILE').
  describe('p', 'Port at which proxy will listen').
  describe('t', 'Full URL of the proxy target. You can specify multiple ' +
           'targets)').
  describe('r', 'Root URL at which the proxied target is accessible. You can' +
           'specify multiple root URLs for each target.').
  describe('s', 'Static content directory served by proxy').
  describe('n', 'Suppress Accept-Language header on broken servers').
  describe('h', 'Show usage documentation');

var makeArr = function(v) {
  if (Object.prototype.toString.call(v) === '[object Array]') {
    return v; 
  }
  return [v];
};

// Parse arguments

var opts = argv.argv;

if (opts.h) {
  console.log(argv.help());
  process.exit(0);
}

var confFile = opts.c || opts._[0];
var conf = {};

var setDefault = function(o, k, v) {
  if (o[k] == null || o[k] === '') {
    o[k] = v;
  }
};

// Load and parse configuration file if any

if (confFile) {
  conf = JSON.parse(fs.readFileSync(confFile, {encoding: 'utf-8'}));
}

// Set all defaults

setDefault(conf, 'baseDir', opts.static);
setDefault(conf, 'target', opts.target);
setDefault(conf, 'rootPath', opts.url);
setDefault(conf, 'port', opts.port);
setDefault(conf, 'noLang', opts['no-lang']);

// Normalize target and rootPath properties (they have to be arrays)
conf.target = makeArr(conf.target);
conf.rootPath = makeArr(conf.rootPath);

var baseDir = conf.baseDir;
var rootPath = conf.rootPath;
var port = conf.port;

var reSlash = function(s) {
  s = s.replace(/^\//, '');
  if (s.length) {
    return '/' + s;
  }
  return '/';
};

// Keep track of hostnames
var hosts = [];

var mkService = function (target, root) {
  target = url.parse(target); 
  root = reSlash(root || target.path);

  hosts.push(target.hostname);

  return {
    target: {
      host: target.hostname,
      port: target.port || 80,
      https: target.protocol === 'https:',
      rejectUnauthorized: false,
    },
    rootPath: root,
    baseUrl: reSlash(target.path),
    pathRe: new RegExp('^' + root)
  };
};

var services = conf.target.map(function(target, i) {
  return mkService(target, conf.rootPath[i]);
});

// Target configuration for local static server
var local = {
  target: {
    host: 'localhost',
    port: port + 1
  }
};

EMO_SHINE = "(^o^)/";
EMO_SAD = "(;.;)~";
EMO_EMBARRASED = "(-.-')";

// Static server at 8081 servinf from the www directory
httpServer = new HTTPServer({root: baseDir});
httpServer.listen(local.target.port);

console.log(EMO_SHINE + ' Serving static files in \'' + baseDir + '\' at ' + 
            local.target.host + ':' + local.target.port);

// Log uncaught errors
process.on('uncaughtException', function(err) {
  console.log(EMO_EMBARRASED + ' ~{ ' + err + ' }');
});

// Create proxy server with URL rewriting
proxyServer = httpProxy.createServer(function(req, res, proxy) {
  var matchingServices;
  var backend;

  console.log(req.method + ':' + req.url);

  matchingServices = services.filter(function(service) {
    return req.url.match(service.pathRe);
  });

  if (matchingServices.length) {
    // If it's a request going for service:
    backend = matchingServices[0];
    req.url = req.url.replace(backend.rootPath, backend.baseUrl);
  } else {
    // For all other requests go to internal static server:
    backend = local;
  }

  console.log(EMO_SHINE + ' ' + backend.target.host + ':' + 
    backend.target.port + req.url);
  proxy.proxyRequest(req, res, backend);
});

proxyServer.proxy.on('start', function(req, res, target) {
  if (hosts.indexOf(target.host) > -1) {
    if (conf.noLang) {
      // Remove accept-language to prevent i18n-related redirects
      delete req.headers['accept-language'];
    }

    // Fix the host without causing XSS prevention to kick in. 
    // Normally, this should have been achieved by `service.changeOrigin`, but
    // that setting is slightly broken and causes XSS errors.
    req.headers.host = target.host;
  }
});

proxyServer.proxy.on('proxyError', function(err) {
  var msg;

  switch (err.code) {
    case ('ETIMEDOUT'):
      msg = 'Connection to target timed out';
      break;
    case ('ECONNRESET'):
      msg = 'Client connection was reset';
      break;
    case ('ENOTFOUND'):
      msg = 'Proxy target domain could not be found or was unreachable. ' + 
        'Please check your configuration.';
      break;
    default:
      msg = 'Unknown connection error ' + err.code;
  }
  console.log(EMO_EMBARRASED + ' ~{ ' + msg + ' }');
});

proxyServer.listen(port);

// Enjoy!
var proxyAddress = '0.0.0.0:' + port;
console.log(EMO_SHINE + ' Proxy server listening on ' + proxyAddress);
services.forEach(function(service) {
  console.log(EMO_SHINE + ' ' + proxyAddress + service.rootPath + ' ~~> ' + 
    service.target.host + ':' + service.target.port + service.baseUrl + 
    (service.target.https ? ' with SSL' : ''));
});
console.log('Press Ctrl-C twice to stop.\n');
