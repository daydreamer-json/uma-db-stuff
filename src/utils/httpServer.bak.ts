import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import open from 'open';
import exitUtils from './exit.js';
import logger from './logger.js';

async function main() {
  const app = new Hono();
  const port = 54348;
  app.use(
    '/*',
    serveStatic({
      root: './output',
      rewriteRequestPath: (path) => {
        // Windows環境のパス問題を解決
        return path.replace(/^\//, '').replace(/\/+/g, '/');
      },
      onNotFound: (path) => {
        logger.warn(`Requested file not found: ${path}`);
      },
    }),
  );
  const startServer = () =>
    new Promise<ReturnType<typeof serve>>((resolve) => {
      const server = serve({ fetch: app.fetch, port }, (_info) => resolve(server));
    });
  try {
    const server = await startServer();
    const targetUrl = `http://localhost:${port}/db/handbook.html`;
    logger.debug(`HTTP server running at http://localhost:${port}`);
    await open(targetUrl);
    logger.debug('Press any key to close the server');
    await exitUtils.pressAnyKeyToContinue();
    server.close();
  } catch (error) {
    console.error('Failed to start server:', error);
    // await exitUtils.pressAnyKeyToExit(1);
  }
}

export default {
  main,
};
