import path from 'node:path';
import configUser from '../utils/configUser.js';
import fileUtils from '../utils/file.js';
import httpServerUtils from '../utils/httpServer.js';

async function mainCmdHandler() {
  if (
    await fileUtils.checkFileExists(
      path.join(configUser.getConfig().file.outputPath, configUser.getConfig().file.outputSubPath.db, 'handbook.html'),
    )
  ) {
    await httpServerUtils.main();
  } else {
    throw new Error('Handbook not found. Please generate with dumpdb command');
  }
}

export default mainCmdHandler;
