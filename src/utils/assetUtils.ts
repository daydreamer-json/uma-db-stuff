import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import util from 'node:util';
import cliProgress from 'cli-progress';
import EventEmitter from 'node:events';
import appConfig from './config.js';
import fileUtils from './fileUtils.js';
import argvUtils from './argv.js';
import logger from './logger.js';
import * as TypesAssetEntry from '../types/AssetEntry.js';
import vgmUtils from './vgmUtils.js';
import assetTextUtils from './assetTextUtils.js';
const execPromise = util.promisify(child_process.exec);

async function extractUnityAssetBundles(
  assetEntries: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }>,
) {
  await new Promise<void>(async (resolve) => {
    logger.info('Extracting Unity asset bundles ...');
    const progressBar =
      argvUtils.getArgv().noShowProgress === false
        ? new cliProgress.SingleBar({
            format: '{bar} {percentage}% | {value}/{total} files | {duration_formatted}/{eta_formatted}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    progressBar?.start(assetEntries.length, 0);
    let activeProcessingCount = 0;
    const processedAssetEntry: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }> = new Array();
    const processEmitter = new EventEmitter();
    const waitForAvailableThread = async () => {
      if (activeProcessingCount < argvUtils.getArgv().thread) {
        return;
      }
      await new Promise((resolve) => {
        processEmitter.once('threadAvailable', resolve);
      });
    };
    for (let i = 0; i < assetEntries.length; i++) {
      await waitForAvailableThread();
      activeProcessingCount++;
      (async () => {
        await (async () => {
          try {
            const files = await fs.promises.readdir(
              path.dirname(
                path.join(
                  argvUtils.getArgv().outputDir,
                  appConfig.file.assetUnityInternalPathDir,
                  assetEntries[i].name,
                ),
              ),
            );
            for (const file of files.filter((el) =>
              new RegExp(`${path.parse(assetEntries[i].name).name}.*\$`).test(el),
            )) {
              await fs.promises.rm(
                path.join(
                  path.dirname(
                    path.join(
                      argvUtils.getArgv().outputDir,
                      appConfig.file.assetUnityInternalPathDir,
                      assetEntries[i].name,
                    ),
                  ),
                  file,
                ),
              );
            }
          } catch (error) {
            // throw error;
          }
        })();
        await (async () => {
          try {
            const result = await execPromise(
              `"${appConfig.file.assetStudioCliPath}" "${path.join(
                appConfig.file.assetDir,
                assetEntries[i].hash.slice(0, 2),
                assetEntries[i].hash,
              )}" --output "${argvUtils.getArgv().outputDir}"`,
            );
          } catch (error) {
            // throw error;
          }
        })();
        if (assetEntries[i].name.match(/^live\/musicscores\//)) {
          const csvParseResult = await assetTextUtils.parseCsvFile(
            path.join(
              argvUtils.getArgv().outputDir,
              appConfig.file.assetUnityInternalPathDir,
              assetEntries[i].name + '.csv',
            ),
          );
        }
      })().then(async () => {
        processedAssetEntry.push(assetEntries[i]);
        activeProcessingCount--;
        progressBar?.increment(1);
        if (activeProcessingCount < argvUtils.getArgv().thread) {
          processEmitter.emit('threadAvailable');
        }
        if (processedAssetEntry.length === assetEntries.length) {
          await afterAllProcessedFunc();
        }
      });
    }

    const afterAllProcessedFunc = async () => {
      progressBar?.stop();
      resolve();
    };
  });
}

async function extractCriAudioAssets(
  assetEntries: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }>,
) {
  const cmdLineArray: Array<Array<string>> = new Array();
  await (async () => {
    await new Promise<void>(async (resolve) => {
      logger.info('Copying data and analyzing CRI audio metadata ...');
      const progressBar =
        argvUtils.getArgv().noShowProgress === false
          ? new cliProgress.SingleBar({
              format: '{bar} {percentage}% | {value}/{total} files | {duration_formatted}/{eta_formatted} | {name}',
              ...appConfig.logger.progressBarConfig,
            })
          : null;
      progressBar?.start(assetEntries.length, 0, {
        name: assetEntries[0].name,
      });
      let activeProcessingCount = 0;
      const processedAssetEntry: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }> = new Array();
      const processEmitter = new EventEmitter();
      const waitForAvailableThread = async () => {
        if (activeProcessingCount < argvUtils.getArgv().thread) {
          return;
        }
        await new Promise((resolve) => {
          processEmitter.once('threadAvailable', resolve);
        });
      };
      for (let i = 0; i < assetEntries.length; i++) {
        await waitForAvailableThread();
        activeProcessingCount++;
        (async () => {
          await fs.promises.mkdir(
            path.dirname(
              path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, assetEntries[i].name),
            ),
            { recursive: true },
          );
          await fs.promises.copyFile(
            path.join(appConfig.file.assetDir, assetEntries[i].hash.slice(0, 2), assetEntries[i].hash),
            path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, assetEntries[i].name),
          );
          const cmdLineEntry = await vgmUtils.generateCmdSingleFileAudio(
            path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, assetEntries[i].name),
          );
          cmdLineArray.push(cmdLineEntry);
        })().then(async () => {
          processedAssetEntry.push(assetEntries[i]);
          activeProcessingCount--;
          progressBar?.increment(1, {
            name: assetEntries[i + 1] ? assetEntries[i + 1].name : assetEntries[i].name,
          });
          if (activeProcessingCount < argvUtils.getArgv().thread) {
            processEmitter.emit('threadAvailable');
          }
          if (processedAssetEntry.length === assetEntries.length) {
            await afterAllProcessedFunc();
          }
        });
      }
      const afterAllProcessedFunc = async () => {
        progressBar?.stop();
        resolve();
      };
    });
  })();
  await new Promise<void>(async (resolve) => {
    logger.info('Encoding CRI audio data ...');
    const progressBar =
      argvUtils.getArgv().noShowProgress === false
        ? new cliProgress.SingleBar({
            format: '{bar} {percentage}% | {value}/{total} process | {duration_formatted}/{eta_formatted}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    progressBar?.start(cmdLineArray.length, 0);
    let activeProcessingCount = 0;
    const processedCmdEntry: Array<Array<string>> = new Array();
    const processEmitter = new EventEmitter();
    const waitForAvailableThread = async () => {
      if (activeProcessingCount < argvUtils.getArgv().thread) {
        return;
      }
      await new Promise((resolve) => {
        processEmitter.once('threadAvailable', resolve);
      });
    };

    for (let i = 0; i < cmdLineArray.length; i++) {
      await waitForAvailableThread();
      activeProcessingCount++;
      (async () => {
        for (const cmdLnEntry of cmdLineArray[i]) {
          await execPromise(cmdLnEntry);
        }
      })().then(async () => {
        processedCmdEntry.push(cmdLineArray[i]);
        activeProcessingCount--;
        progressBar?.increment(1);
        if (activeProcessingCount < argvUtils.getArgv().thread) {
          processEmitter.emit('threadAvailable');
        }
        if (processedCmdEntry.length === cmdLineArray.length) {
          await afterAllProcessedFunc();
        }
      });
    }

    const afterAllProcessedFunc = async () => {
      progressBar?.stop();
      for (const entry of assetEntries) {
        await fs.promises.rm(
          path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, entry.name),
        );
      }
      resolve();
    };
  });
}

async function extractSingleAsset(assetEntry: TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }) {
  const extractWithASCli = async () => {
    try {
      const result = await execPromise(
        `"${appConfig.file.assetStudioCliPath}" "${path.join(
          appConfig.file.assetDir,
          assetEntry.hash.slice(0, 2),
          assetEntry.hash,
        )}" --output "${argvUtils.getArgv().outputDir}"`,
      );
      console.log(result.stdout);
    } catch (error) {
      throw error;
    }
  };
  const extractCriAudio = async () => {
    await fs.promises.mkdir(
      path.dirname(path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, assetEntry.name)),
      { recursive: true },
    );
    await fs.promises.copyFile(
      path.join(appConfig.file.assetDir, assetEntry.hash.slice(0, 2), assetEntry.hash),
      path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, assetEntry.name),
    );
    await vgmUtils.generateCmdSingleFileAudio(
      path.join(argvUtils.getArgv().outputDir, appConfig.file.assetUnityInternalPathDir, assetEntry.name),
    );
  };
  if (['.acb', '.awb', '.acf'].includes(path.extname(assetEntry.name))) {
    await extractCriAudio();
  } else if (['.usm'].includes(path.extname(assetEntry.name))) {
  } else {
    await extractWithASCli();
  }
}

async function assetsFileExistsCheck(assetDb: Array<TypesAssetEntry.AssetDbConvertedEntry>) {
  const retArray: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }> = new Array();
  logger.info('Checking for the existence of all asset files ...');
  const progressBar =
    argvUtils.getArgv().noShowProgress === false
      ? new cliProgress.SingleBar({
          format: '{bar} {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted} | {hash}',
          ...appConfig.logger.progressBarConfig,
        })
      : null;
  progressBar?.start(assetDb.length, 0, {
    hash: assetDb[0].name,
  });
  for (let i = 0; i < assetDb.length; i++) {
    retArray.push({
      ...assetDb[i],
      isFileExists: await fileUtils.exists(
        path.join(appConfig.file.assetDir, assetDb[i].hash.slice(0, 2), assetDb[i].hash),
      ),
    });
    progressBar?.increment(1, {
      hash: assetDb[i + 1]?.name ?? assetDb[i]?.name,
    });
  }
  progressBar?.stop();
  return retArray;
}

export default {
  extractUnityAssetBundles,
  extractCriAudioAssets,
  assetsFileExistsCheck,
};
