import path from 'node:path';
import argvUtils from './utils/argv.js';
// import assetsUtils from './utils/assets.js';
import configUser from './utils/configUser.js';
// import dbUtils from './utils/db.js';
// import downloadUtils from './utils/download.js';
// import exitUtils from './utils/exit.js';
// import fileUtils from './utils/file.js';
import logger from './utils/logger.js';
// import processUtils from './utils/process.js';
import reaperUtils from './utils/reaper.js';

async function mainCmdHandler() {
  await reaperUtils.reaperCleaning();
  await reaperUtils.tr5StealthLimiter_runPlugin(
    path.join(
      argvUtils.getArgv()['outputDir'],
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      `l1053_mix_raw.wav`,
    ),
    path.join(
      argvUtils.getArgv()['outputDir'],
      configUser.getConfig().file.outputSubPath.renderedAudio,
      `l1053_mix_norm_test.wav`,
    ),
    path.join(
      argvUtils.getArgv()['outputDir'],
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      `batch.conf`,
    ),
    { input: 10.5, output: -0.05 },
  );
  await reaperUtils.reaperCleaning();

  logger.info('All completed');
}

export default mainCmdHandler;
