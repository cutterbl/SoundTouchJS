import connect from 'connect';
import path from 'path';
import serveStatic from 'serve-static';
import open from 'open';
import localip from 'localip';
import * as url from 'url';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
const ip = localip();
const port = 8080;

connect()
  .use(serveStatic(path.join(__dirname, '../public')))
  .use(serveStatic(path.join(__dirname, '../dist')))
  .listen(port, function () {
    console.log('dir is ', path.join(__dirname, '../public'));
    console.log(`Listing on http://${ip}:${port}`);
    open(`http://${ip}:${port}`);
  });
