import argvUtils from '../utils/argv';
import downloadUtils from '../utils/download';
import exitUtils from '../utils/exit';

async function mainCmdHandler() {
  await downloadUtils.downloadMissingAssets(argvUtils.getArgv().force);
}

export default mainCmdHandler;
