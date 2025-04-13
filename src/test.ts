import path from 'node:path';
import logger from './utils/logger';
import processUtils from './utils/process';
import fileUtils from './utils/file';
import dbUtils from './utils/db';
import exitUtils from './utils/exit';
import assetsUtils from './utils/assets';
import downloadUtils from './utils/download';
import argvUtils from './utils/argv';
import configUser from './utils/configUser';
import reaperUtils from './utils/reaper';

async function mainCmdHandler() {
  await reaperUtils.reaperCleaning();
  await reaperUtils.tr5StealthLimiter_runPlugin(
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      `l1053_mix_raw.wav`,
    ),
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      `l1053_mix_norm_test.wav`,
    ),
    path.join(
      argvUtils.getArgv().outputDir,
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
