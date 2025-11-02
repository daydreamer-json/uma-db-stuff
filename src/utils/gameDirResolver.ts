import path from 'node:path';
import prompts from 'prompts';
import configUser from './configUser.js';
import exitUtils from './exit.js';
import fileUtils from './file.js';
import logger from './logger.js';

async function resolveGameDir() {
  if (
    configUser.getConfig().file.gameAssetDirPath !== null &&
    configUser.getConfig().file.sqliteDbPath.assetDb !== null &&
    configUser.getConfig().file.sqliteDbPath.masterDb !== null
  ) {
    if (
      (await fileUtils.checkFileExists(path.resolve(configUser.getConfig().file.sqliteDbPath.assetDb!))) &&
      (await fileUtils.checkFileExists(path.resolve(configUser.getConfig().file.sqliteDbPath.masterDb!))) &&
      (await fileUtils.checkFolderExists(path.resolve(configUser.getConfig().file.gameAssetDirPath!))) === true
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
        await prompts(
          {
            type: 'text',
            name: 'value',
            message: `Enter game asset dir path`,
            initial: '',
          },
          {
            onCancel: async () => {
              await exitUtils.exit(1, 'Aborted by user');
            },
          },
        )
      ).value.replace(/^["']|["']$/g, '');
      if (await fileUtils.checkFolderExists(path.resolve(userInputPath))) {
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
  const userProfilePath = process.env['USERPROFILE']?.replace(path.parse(process.env['USERPROFILE']).root, '');
  const driveLetterArray = [...Array.from({ length: 26 }, (_, i) => String.fromCharCode(68 + i)), 'A', 'B', 'C']; // D-Z+A+B+C
  const suggestedTargetPathArray = [
    '/Games/Cygames/umamusume/' + targetFileName,
    '/Games/Umamusume/Cygames/umamusume/' + targetFileName,
    '/Games/umamusume/Cygames/umamusume/' + targetFileName,
    '/Games/Umamusume/res',
    '/' + userProfilePath + '/AppData/LocalLow/Cygames/umamusume/' + targetFileName,
  ];
  for (const driveLetter of driveLetterArray) {
    for (const suggestedTargetPath of suggestedTargetPathArray) {
      const pathStr = path.resolve(driveLetter + ':' + suggestedTargetPath);
      if (await fileUtils.checkFileExists(pathStr)) {
        return pathStr;
      }
    }
  }
  return null;
}

export default {
  resolveGameDir,
};
