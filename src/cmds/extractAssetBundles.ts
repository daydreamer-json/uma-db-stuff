import argvUtils from '../utils/argv';
import downloadUtils from '../utils/download';
import dbUtils from '../utils/db';
import assetsUtils from '../utils/assets';
import logger from '../utils/logger';
import exitUtils from '../utils/exit';

async function mainCmdHandler() {
  const regex = new RegExp(`^.*${argvUtils.getArgv().path}.*$`, 'g');
  if ((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)).length == 0) {
    logger.error(`No assets were found that hit the pattern: ${regex}`);
    await exitUtils.pressAnyKeyToExit(1);
  }
  if ((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
    await downloadUtils.downloadMissingAssets(
      false,
      (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
    );
    await dbUtils.loadAllDb(false);
  }
  await assetsUtils.extractUnityAssetBundles((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)));
}

export default mainCmdHandler;
