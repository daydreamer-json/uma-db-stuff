import bun from 'bun';
import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import logger from './logger';
import configUser from './configUser';
import exitUtils from './exit';

async function resolveGameDir() {
  if (
    configUser.getConfig().file.gameAssetDirPath !== null &&
    configUser.getConfig().file.sqliteDbPath.assetDb !== null &&
    configUser.getConfig().file.sqliteDbPath.masterDb !== null
  ) {
    if (
      (await bun.file(path.resolve(configUser.getConfig().file.sqliteDbPath.assetDb!)).exists()) &&
      (await bun.file(path.resolve(configUser.getConfig().file.sqliteDbPath.masterDb!)).exists()) &&
      (await checkFolderExists(path.resolve(configUser.getConfig().file.gameAssetDirPath!))) === true
    ) {
      logger.info(
        'Found game asset dir path: ' + path.dirname(path.resolve(configUser.getConfig().file.sqliteDbPath.assetDb!)),
      );
      return;
    } else {
      logger.warn('Game asset dir path specified in config does not exist');
    }
  }
  logger.debug('Trying to resolve game asset dir path ...');
  const autoResolveResult = await tryAutoResolveGameDir();
  if (autoResolveResult === null) {
    logger.warn('Failed to automatically resolve the game path. Requesting user to enter ...');
    while (true) {
      const userInputPath = (
        await prompts({
          type: 'text',
          name: 'value',
          message: `Enter game asset dir path`,
          initial: '',
        })
      ).value.replace(/^["']|["']$/g, '');
      if (await checkFolderExists(path.resolve(userInputPath))) {
        logger.info('Found game asset dir path: ' + path.resolve(userInputPath));
        await configUser.setConfig({
          ...configUser.getConfig(),
          file: {
            ...configUser.getConfig().file,
            gameAssetDirPath: path.join(path.resolve(userInputPath), 'dat'),
            sqliteDbPath: {
              assetDb: path.join(path.resolve(userInputPath), 'meta'),
              masterDb: path.join(path.resolve(userInputPath), 'master/master.mdb'),
            },
          },
        });
        return;
      } else {
        logger.error('Game exe not found: ' + path.resolve(userInputPath));
      }
    }
  } else {
    logger.info('Found game asset dir path: ' + path.dirname(autoResolveResult));
    await configUser.setConfig({
      ...configUser.getConfig(),
      file: {
        ...configUser.getConfig().file,
        gameAssetDirPath: path.join(path.dirname(autoResolveResult), 'dat'),
        sqliteDbPath: {
          assetDb: path.join(path.dirname(autoResolveResult), 'meta'),
          masterDb: path.join(path.dirname(autoResolveResult), 'master/master.mdb'),
        },
      },
    });
    return;
  }
}

async function tryAutoResolveGameDir(): Promise<string | null> {
  // ディレクトリの判定がめんどいので直下にあるmetaファイルをターゲットにスキャンする
  // ウマ娘はオンデマンドアセットと追加アセットのDL先が固定でCドライブなので
  // D-Zドライブにシンボリックリンクを作成した場合にそちらを優先的にスキャンする
  // ない場合は(最後に)Cドライブをスキャンする
  //! D-Zまですべてスキャンしたときのオーバーヘッドは未知
  const targetFileName = 'meta';
  const userProfilePath = process.env.USERPROFILE?.replace(path.parse(process.env.USERPROFILE).root, '');
  const driveLetterArray = [...Array.from({ length: 26 }, (_, i) => String.fromCharCode(68 + i)), 'A', 'B', 'C']; // D-Z+A+B+C
  const suggestedTargetPathArray = [
    '/Games/Cygames/umamusume/' + targetFileName,
    '/Games/Umamusume/Cygames/umamusume/' + targetFileName,
    '/Games/umamusume/Cygames/umamusume/' + targetFileName,
    '/' + userProfilePath + '/AppData/LocalLow/Cygames/umamusume/' + targetFileName,
  ];
  for (const driveLetter of driveLetterArray) {
    for (const suggestedTargetPath of suggestedTargetPathArray) {
      const pathStr = path.resolve(driveLetter + ':' + suggestedTargetPath);
      if (await bun.file(pathStr).exists()) {
        return pathStr;
      }
    }
  }
  return null;
}

async function checkFolderExists(folderPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(folderPath);
    return stats.isDirectory();
  } catch (error: any) {
    // if (error.code === 'ENOENT') {
    //   return false;
    // }
    // throw error;
    return false;
  }
}

async function getFileList(dirPath: string): Promise<string[]> {
  const filePaths: string[] = [];
  const scanner = new bun.Glob('**/*').scan({
    cwd: dirPath,
    absolute: true,
    onlyFiles: true,
  });
  for await (const filePath of scanner) filePaths.push(filePath);
  return filePaths;
}

export default {
  resolveGameDir,
  checkFolderExists,
  getFileList,
};
