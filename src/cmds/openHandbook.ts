import path from 'node:path';
import bun from 'bun';
import configUser from '../utils/configUser.js';
import httpServerUtils from '../utils/httpServer.js';

async function mainCmdHandler() {
  if (
    await bun
      .file(
        path.join(
          configUser.getConfig().file.outputPath,
          configUser.getConfig().file.outputSubPath.db,
          'handbook.html',
        ),
      )
      .exists()
  ) {
    await httpServerUtils.main();
  } else {
    throw new Error('Handbook not found. Please generate with dumpdb command');
  }
}

export default mainCmdHandler;
