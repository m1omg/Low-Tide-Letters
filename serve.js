#!/usr/bin/env node
/*
 * serve.js - tiny dependency-free static file server for the game.
 *   node serve.js [--port N] [--open] [--quiet]
 * Default port 8765; when it is busy the next free port is used. Nothing is cached.
 * Can also be required: require('./serve.js').start({port, quiet}) -> Promise<{server, port, url, close}>
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = __dirname;
const DEFAULT_PORT = 8765;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, status, body, headers) {
  res.writeHead(status, Object.assign({
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  }, headers || {}));
  res.end(body);
}

function handler(quiet) {
  return function (req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') { send(res, 405, 'Method not allowed'); return; }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch (e) {
      send(res, 400, 'Bad request');
      return;
    }
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = path.normalize(path.join(ROOT, pathname));
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) { send(res, 403, 'Forbidden'); return; }
    fs.stat(file, function (err, st) {
      if (err || !st.isFile()) {
        if (!quiet && !/favicon\.ico$/.test(pathname)) console.log('404 ' + pathname);
        send(res, 404, 'Not found: ' + pathname);
        return;
      }
      const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = fs.createReadStream(file);
      stream.on('error', function () { res.destroy(); });
      stream.pipe(res);
    });
  };
}

/**
 * Starts the server on the first free port at or after opts.port.
 * @param {{port?:number, quiet?:boolean, host?:string}} [opts]
 * @returns {Promise<{server:http.Server, port:number, url:string, close:function():Promise<void>}>}
 */
function start(opts) {
  opts = opts || {};
  const first = opts.port || DEFAULT_PORT;
  const host = opts.host || '127.0.0.1';
  return new Promise(function (resolve, reject) {
    let port = first;
    const tryListen = function () {
      const server = http.createServer(handler(!!opts.quiet));
      server.once('error', function (err) {
        if (err.code === 'EADDRINUSE' && port < first + 100) { port++; tryListen(); } else reject(err);
      });
      server.listen(port, host, function () {
        const url = 'http://localhost:' + port + '/';
        resolve({
          server: server,
          port: port,
          url: url,
          close: function () {
            return new Promise(function (done) {
              if (server.closeAllConnections) server.closeAllConnections();
              server.close(function () { done(); });
            });
          },
        });
      });
    };
    tryListen();
  });
}

function openBrowser(url) {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', function () { /* no browser launcher available: the URL is printed anyway */ });
    child.unref();
  } catch (e) { /* ignore */ }
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  let port = DEFAULT_PORT;
  const pi = argv.indexOf('--port');
  if (pi >= 0) {
    port = parseInt(argv[pi + 1], 10);
    if (!(port > 0 && port < 65536)) { console.error('usage: node serve.js [--port N] [--open]'); process.exit(1); }
  }
  start({ port: port, quiet: argv.includes('--quiet') }).then(function (s) {
    if (s.port !== port) console.log('Port ' + port + ' is busy, using ' + s.port + ' instead.');
    console.log('Game running at ' + s.url + '   (Ctrl+C to stop)');
    if (argv.includes('--open')) openBrowser(s.url);
  }).catch(function (err) {
    console.error('Could not start the server: ' + err.message);
    process.exit(1);
  });
}

module.exports = { start: start, MIME: MIME };
