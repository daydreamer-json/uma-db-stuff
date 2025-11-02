import argvUtils from '../utils/argv.js';
import downloadUtils from '../utils/download.js';

async function mainCmdHandler() {
  await downloadUtils.downloadMissingAssets(argvUtils.getArgv()['force']);
}

export default mainCmdHandler;
