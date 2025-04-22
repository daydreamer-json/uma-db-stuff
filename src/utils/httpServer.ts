import bun from 'bun';
import { Hono } from 'hono';
import open from 'open';
import logger from './logger';
import exitUtils from './exit';
// import { existsSync } from 'node:fs';
import path from 'node:path';
import { getMimeType } from 'hono/utils/mime';

async function main() {
  const app = new Hono();
  const port = 54348;

  // カスタム静的ファイルミドルウェア
  app.use('/*', async (c, next) => {
    const requestPath = c.req.path;
    const normalizedPath = requestPath.replace(/^\/+/, '').replace(/\/+/g, '/');
    const filePath = path.join('./output', normalizedPath);

    if (await bun.file(filePath).exists()) {
      try {
        const file = bun.file(filePath);
        if (await file.exists()) {
          const mimeType = getMimeType(path.extname(filePath)) || 'text/plain';
          // logger.trace(file, mimeType);
          return new Response(file);
        }
      } catch (error) {
        logger.warn(`Error serving file: ${filePath}`, error);
      }
    }
    logger.warn(`Requested file not found: ${requestPath}`);
    await next();
    return c.notFound();
  });

  // サーバー起動
  const server = bun.serve({
    port,
    fetch: app.fetch,
  });

  const targetUrl = `http://localhost:${port}/db/handbook.html`;
  logger.debug(`HTTP server running at ${targetUrl}`);
  await open(targetUrl);
  logger.debug('Press any key to close the server...');
  await exitUtils.pressAnyKeyToContinue();
  server.stop();
}

export default {
  main,
};
