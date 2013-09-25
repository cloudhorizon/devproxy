var httpProxy = require('http-proxy');
var HTTPServer = require('http-server').HTTPServer;
var util = require('util');
var fs = require('fs');
var url = require('url');

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

// ---- DO NOT CHANGE ANYTHING BELOW THIS LINE ----

var confFile = process.argv[2];
var conf;

var setDefault = function(o, k, v) {
  if (o[k] == null || o[k] === '') {
    o[k] = v;
  }
};

if (confFile) {
  conf = JSON.parse(fs.readFileSync(confFile, {encoding: 'utf-8'}));
  setDefault(conf, 'baseDir', DEFAULT_STATIC_DIR);
  setDefault(conf, 'target', DEFAULT_TARGET);
  setDefault(conf, 'rootPath', DEFAULT_ROOT_PATH);
  setDefault(conf, 'port', DEFAULT_PORT);
}

var baseDir = conf.baseDir;
var target = url.parse(conf.target); 
var rootPath = conf.rootPath;
var port = conf.port;

var reSlash = function(s) {
  s = s.replace(/^\//, '').replace(/\/$/, '');
  if (s.length) {
    return '/' + s + '/';
  }
  return '/';
};

console.log(reSlash(target.path));

var service = {
  target: {
    host: target.hostname,
    port: target.port || 80,
    https: target.protocol === 'https:',
    rejectUnauthorized: false,
  },
  rootPath: reSlash(rootPath || target.path),
  baseUrl: reSlash(target.path)
};

// Target configuration for local static server
var local = {
  target: {
    host: '127.0.0.1',
    port: port + 1
  }
};

EMO_SHINE = "(^o^)/";
EMO_SAD = "(;.;)~";
EMO_EMBARRASED = "(-.-')";

// Static server at 8081 servinf from the www directory
httpServer = new HTTPServer({root: baseDir});
httpServer.listen(local.host, local.port);

console.log(EMO_SHINE + ' Serving static files in \'' + baseDir + '\' at ' + 
            local.target.host + ':' + local.target.port);

// Log uncaught errors
process.on('uncaughtException', function(err) {
  console.log(EMO_EMBARRASED + ' ~{ ' + err + ' }');
});

proxyPathRe = new RegExp('^' + service.rootPath);

// Create proxy server with URL rewriting
proxyServer = httpProxy.createServer(function(req, res, proxy) {
  var backend;

  console.log(req.method + ':' + req.url);

  if (req.url.match(proxyPathRe)) {
    // If it's a request going for service:
    req.url = req.url.replace(service.rootPath, service.baseUrl);
    backend = service;
  } else {
    // For all other requests go to internal static server:
    backend = local;
  }

  console.log(EMO_SHINE + ' ' + backend.target.host + ':' + 
    backend.target.port + req.url);
  proxy.proxyRequest(req, res, backend);
});

proxyServer.listen(port);

proxyServer.proxy.on('start', function(req, res, target) {
  if (target.host === service.target.host) {
    // Remove accept-language to prevent i18n-related redirects
    delete req.headers['accept-language'];

    // Fix the host without causing XSS prevention to kick in. 
    // Normally, this should have been achieved by `service.changeOrigin`, but
    // that setting is slightly broken and causes XSS errors.
    req.headers.host = service.target.host;
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

// Enjoy!
var proxyAddress = '0.0.0.0:' + port;
console.log(EMO_SHINE + ' Proxy server listening on ' + proxyAddress);
console.log(EMO_SHINE + ' ' + proxyAddress + service.rootPath + ' ~~> ' + 
  service.target.host + ':' + service.target.port + service.baseUrl + 
  (service.target.https ? ' with SSL' : ''));
console.log('Press Ctrl-C twice to stop.\n');
