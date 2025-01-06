import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import ky from 'ky';
import lz4 from 'lz4-napi';
import appConfig from './utils/config.js';
import argvUtils from './utils/argv.js';
import logger from './utils/logger.js';
import dbUtils from './utils/dbUtils.js';
import downloadUtils from './utils/downloadUtils.js';
import assetUtils from './utils/assetUtils.js';
import audioGenerateUtils from './utils/audioGenerateUtils.js';

async function mainCmdHandler() {
  logger.level = argvUtils.getArgv().logLevel;
  const db = await dbUtils.loadAllDatabase();
  await downloadUtils.downloadMissingAssets(db.assetDb, false);
  await (async () => {
    logger.info('Updating master database ...');
    await downloadUtils.downloadMissingAssets(
      db.assetDb.filter((entry) => entry.kind === 'master'),
      true,
    );
    const masterDbAssetEntry = db.assetDb.filter((entry) => entry.kind === 'master')[0];
    const compressedBuffer = await fs.promises.readFile(
      path.join(appConfig.file.assetDir, masterDbAssetEntry.hash.slice(0, 2), masterDbAssetEntry.hash),
    );
    const decompressedBuffer = await lz4.decompressFrame(compressedBuffer);
    await fs.promises.writeFile(appConfig.file.sqlDbPath.masterDb, decompressedBuffer);
  })();
  await assetUtils.extractUnityAssetBundles(
    db.assetDb.filter((entry) => entry.name.match(/^live\/(image|jacket|musicscores)\//)),
  );
  await assetUtils.extractCriAudioAssets(
    db.assetDb.filter((entry) => entry.name.match(/^sound\/l\/.*\.(acf|acb|awb)$/)),
  );
}

export default mainCmdHandler;
