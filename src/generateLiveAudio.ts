import fs from 'node:fs';
import path from 'node:path';
import { DateTime } from 'luxon';
import ky from 'ky';
import lz4 from 'lz4-napi';
import prompts from 'prompts';
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

  const liveId = await prompts({
    type: 'select',
    name: 'value',
    message: 'Select live track',
    // initial: 0,
    choices: db.masterDb.live_data
      .filter((entry: any) => entry.has_live === 1)
      .map((entry: any) => ({
        title:
          entry.music_id +
          ' - ' +
          db.masterDb.text_data.find(
            (texEntry: any) => texEntry.id === 16 && texEntry.category === 16 && texEntry.index === entry.music_id,
          ).text,
        description: db.masterDb.text_data
          .find(
            (texEntry: any) => texEntry.id === 128 && texEntry.category === 128 && texEntry.index === entry.music_id,
          )
          .text.split('\\n')[0],
        value: entry.music_id,
      })),
  });
  await audioGenerateUtils.test(db, liveId.value);
}

export default mainCmdHandler;
