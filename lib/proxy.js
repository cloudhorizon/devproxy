var httpProxy = require('http-proxy');
var HTTPServer = require('http-server').HTTPServer;
var util = require('util');
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

// ---- DO NOT CHANGE ANYTHING BELOW THIS LINE ----

// Process command line options
//
// The first option is the base directory for static files.
//
var baseDir = process.argv[2] || DEFAULT_STATIC_DIR;
var target = url.parse(process.argv[3] || DEFAULT_TARGET); 
var rootPath = process.argv[4] || DEFAULT_ROOT_PATH;

var service = conf.service || {
  target: {
    host: target.host,
    port: target.port || 80,
    https: target.protocol === 'https:',
    rejectUnauthorized: false,
  },
  rootPath: rootPath || target.path,
  baseUrl: target.path
};

// Target configuration for local static server
var local = {
  target: {
    host: 'localhost',
    port: 8081
  }
};

EMO_SHINE = "(^o^)/";
EMO_SAD = "(;.;)~";
EMO_EMBARRASED = "(-.-')";

// Static server at 8081 servinf from the www directory
httpServer = new HTTPServer({root: baseDir});
httpServer.listen(8081);

console.log(EMO_SHINE + ' localhost:8081 from \'' + baseDir + '\'');

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

proxyServer.listen(8080);

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
    default:
      msg = 'Unknown connection error ' + err.code;
  }
  console.log(EMO_EMBARRASED + ' ~{ ' + msg + ' }');
});

// Enjoy!
var proxyAddress = 'localhost:8080';
console.log(EMO_SHINE + ' ' + proxyAddress);
console.log(EMO_SHINE + ' ' + proxyAddress + service.rootPath + ' ~~> ' + 
  service.target.host + ':' + service.target.port + service.baseUrl);
console.log('Press Ctrl-C twice to stop.');
