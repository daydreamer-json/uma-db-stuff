import appConfig from './utils/config.js';
import argvUtils from './utils/argv.js';
import logger from './utils/logger.js';
import dbUtils from './utils/dbUtils.js';
import downloadUtils from './utils/downloadUtils.js';
import assetUtils from './utils/assetUtils.js';

async function mainCmdHandler() {
  logger.level = argvUtils.getArgv().logLevel;
  const db = await dbUtils.loadAllDatabase();
  await downloadUtils.downloadMissingAssets(db.assetDb, false);
  await assetUtils.extractUnityAssetBundles(
    db.assetDb.filter((entry) => entry.name.match(new RegExp(`^.*${argvUtils.getArgv().path}.*$`))),
  );
}

export default mainCmdHandler;
