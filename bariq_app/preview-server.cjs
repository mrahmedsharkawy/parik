const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.env.PREVIEW_ROOT || path.join(__dirname, '..'));
const port = Number(process.env.PORT || 5500);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

http
  .createServer((req, res) => {
    const cleanUrl = decodeURIComponent((req.url || '/').split('?')[0]);
    const urlPath = cleanUrl === '/' ? '/index.html' : cleanUrl;
    let filePath = path.normalize(path.join(root, urlPath));

    if (!filePath.startsWith(root)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(filePath, (statError, stat) => {
      if (statError) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');

      fs.readFile(filePath, (readError, data) => {
        if (readError) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }

        res.writeHead(200, {
          'Content-Type': types[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
          'Cache-Control': 'no-store',
        });
        res.end(data);
      });
    });
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`Bariq preview: http://127.0.0.1:${port}/`);
  });
