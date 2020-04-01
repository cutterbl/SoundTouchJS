const connect = require('connect');
const path = require('path');
const serveStatic = require('serve-static');
connect()
  .use(serveStatic(path.join(__dirname, '../public')))
  .use(serveStatic(path.join(__dirname, '../dist')))
  .listen(8080, function () {
    console.log('dir is ', path.join(__dirname, '../public'));
    console.log('Go to http://localhost:8080');
  });
