const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const ROOT = __dirname;

process.on('uncaughtException', (err) => {
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ERR_STREAM_PREMATURE_CLOSE') {
    return;
  }
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  req.on('error', () => {});
  res.on('error', () => {});

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname = decodeURIComponent(reqUrl.pathname);

  const REDIRECTS = {
    '/products.html': '/services.html',
    '/products': '/services.html',
    '/case-studies.html': '/demo-builds.html',
    '/case-studies': '/demo-builds.html',
    '/about.html': '/about-us.html',
    '/about': '/about-us.html',
  };

  if (REDIRECTS[pathname]) {
    res.writeHead(301, { Location: REDIRECTS[pathname] });
    return res.end();
  }

  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  let filePath = path.normalize(path.join(ROOT, pathname));

  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.statusCode = 404;
        return res.end('Not Found');
      }
      res.statusCode = 500;
      return res.end('Server Error');
    }

    if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      return fs.stat(filePath, (err2, stats2) => {
        if (err2) {
          res.statusCode = 404;
          return res.end('Not Found');
        }
        serveFile(req, res, filePath, stats2);
      });
    }

    serveFile(req, res, filePath, stats);
  });
});

function serveFile(req, res, filePath, stats) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  const range = req.headers.range;
  if (range && ext === '.mp4') {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${stats.size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });

    const stream = fs.createReadStream(filePath, { start, end });
    const cleanup = () => stream.destroy();
    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    stream.on('error', () => { if (!res.writableEnded) res.end(); });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': stats.size,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });

    const stream = fs.createReadStream(filePath);
    const cleanup = () => stream.destroy();
    req.on('close', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);
    stream.on('error', () => { if (!res.writableEnded) res.end(); });
    stream.pipe(res);
  }
}

server.on('error', (err) => {
  console.error('Server error:', err);
});

server.listen(PORT, () => {
  console.log(`Beevolve server running at http://localhost:${PORT}/`);
});
