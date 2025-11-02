import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import * as TypesAssetEntry from '../types/AssetEntry.js';
import argvUtils from './argv.js';
import assetTextUtils from './assetText.js';
import appConfig from './config.js';
import configUser from './configUser.js';
import dbUtils from './db.js';
import fileUtils from './file.js';
import logger from './logger.js';
import mathUtils from './math.js';
import stringUtils from './string.js';
import subProcessUtils from './subProcess.js';
import vgmUtils from './vgm.js';

async function extractUnityAssetBundles(
  assetEntries: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[],
) {
  if (assetEntries.filter((el) => !el.isFileExists).length > 0) {
    throw new Error('Please execute downloadMissingAssets command');
  }
  await new Promise<void>(async (resolve) => {
    logger.info('Extracting Unity asset bundles ...');
    const progressBar =
      argvUtils.getArgv()['noShowProgress'] === false
        ? new cliProgress.SingleBar({
            format: '{bar} {percentageFmt}% | {valueFmt} / {totalFmt} | {name}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    const progressBarFormatter = (currentValue: number, totalValue: number) => {
      return {
        percentageFmt: mathUtils.rounder('ceil', (currentValue / totalValue) * 100, 2).padded.padStart(6, ' '),
        valueFmt: String(currentValue).padStart(String(totalValue).length, ' '),
        totalFmt: String(totalValue).padStart(String(totalValue).length, ' '),
      };
    };
    let activeProcessingCount = 0;
    const processedAssetEntry: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[] = [];
    progressBar?.start(assetEntries.length, processedAssetEntry.length, {
      name: assetEntries[0]!.name,
      ...progressBarFormatter(processedAssetEntry.length, assetEntries.length),
    });
    const processEmitter = new EventEmitter();
    const waitForAvailableThread = async () => {
      if (activeProcessingCount < argvUtils.getArgv()['threadProcessing']) return;
      await new Promise((resolve) => processEmitter.once('threadAvailable', resolve));
    };
    for (let i = 0; i < assetEntries.length; i++) {
      await waitForAvailableThread();
      activeProcessingCount++;
      (async () => {
        await (async () => {
          try {
            const files = await fileUtils.getFileList(
              path.dirname(
                path.join(
                  argvUtils.getArgv()['outputDir'],
                  configUser.getConfig().file.outputSubPath.assets,
                  configUser.getConfig().file.assetUnityInternalPathDir,
                  assetEntries[i]!.name,
                ),
              ),
            );
            for (const file of files.filter((el) =>
              new RegExp(`${path.parse(assetEntries[i]!.name).name}.*\$`).test(el),
            )) {
              await fs.rm(file);
            }
          } catch (error) {}
        })();
        const isAssetEncrypted = assetEntries[i]!.encryptionKey !== 0n;
        const origABPath = path.join(
          configUser.getConfig().file.gameAssetDirPath!,
          assetEntries[i]!.hash.slice(0, 2),
          assetEntries[i]!.hash,
        );
        const decryptedABPath = path.join(
          os.tmpdir(),
          'uma-db-stuff_decryptedAB_' + stringUtils.getRandomHexHashStr(16),
        );
        if (isAssetEncrypted) {
          await fs.writeFile(
            decryptedABPath,
            decryptABBuffer(await fs.readFile(origABPath), generateABDecryptionKey(assetEntries[i]!.encryptionKey)!),
          );
        }
        await (async () => {
          try {
            await subProcessUtils.spawnAsync(
              appConfig.file.cliPath.assetStudio,
              [isAssetEncrypted ? decryptedABPath : origABPath, '--output', argvUtils.getArgv()['outputDir']],
              {},
              false,
            );
          } catch (error) {
            throw error;
          }
        })();
        if (isAssetEncrypted) await fs.rm(decryptedABPath);
        if (assetEntries[i]!.name.match(/^live\/musicscores\//)) {
          await assetTextUtils.parseCsvFile(
            path.join(
              argvUtils.getArgv()['outputDir'],
              configUser.getConfig().file.outputSubPath.assets,
              configUser.getConfig().file.assetUnityInternalPathDir,
              assetEntries[i]!.name + '.csv',
            ),
          );
        }
      })().then(async () => {
        processedAssetEntry.push(assetEntries[i]!);
        activeProcessingCount--;
        progressBar?.increment(1, {
          name: assetEntries[i + 1] ? assetEntries[i + 1]!.name : assetEntries[i]!.name,
          ...progressBarFormatter(processedAssetEntry.length, assetEntries.length),
        });
        if (activeProcessingCount < argvUtils.getArgv()['threadProcessing']) {
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
  assetEntries: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[],
) {
  const cmdLineArray: { command: string; args: string[] }[][] = [];
  await (async () => {
    await new Promise<void>(async (resolve) => {
      logger.info('Analyzing CRI codec metadata ...');
      const progressBar =
        argvUtils.getArgv()['noShowProgress'] === false
          ? new cliProgress.SingleBar({
              format: '{bar} {percentageFmt}% | {valueFmt} / {totalFmt} | {name}',
              ...appConfig.logger.progressBarConfig,
            })
          : null;
      const progressBarFormatter = (currentValue: number, totalValue: number) => {
        return {
          percentageFmt: mathUtils.rounder('ceil', (currentValue / totalValue) * 100, 2).padded.padStart(6, ' '),
          valueFmt: String(currentValue).padStart(String(totalValue).length, ' '),
          totalFmt: String(totalValue).padStart(String(totalValue).length, ' '),
        };
      };
      const processedAssetEntry: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[] = [];
      progressBar?.start(assetEntries.length, processedAssetEntry.length, {
        name: assetEntries[0]!.name,
        ...progressBarFormatter(processedAssetEntry.length, assetEntries.length),
      });
      let activeProcessingCount = 0;
      const processEmitter = new EventEmitter();
      const waitForAvailableThread = async () => {
        if (activeProcessingCount < argvUtils.getArgv()['threadProcessing']) {
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
          await fs.mkdir(
            path.dirname(
              path.join(
                argvUtils.getArgv()['outputDir'],
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                assetEntries[i]!.name,
              ),
            ),
            { recursive: true },
          );
          //! Create symlink instead of copying to avoid disk issue
          await subProcessUtils.spawnAsync(
            'cmd.exe',
            [
              '/c',
              'mklink',
              `${path.join(
                argvUtils.getArgv()['outputDir'],
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                assetEntries[i]!.name,
              )}`,
              `${path.join(
                configUser.getConfig().file.gameAssetDirPath!,
                assetEntries[i]!.hash.slice(0, 2),
                assetEntries[i]!.hash,
              )}`,
            ],
            {},
            false,
          );
          const cmdLineEntry = await vgmUtils.generateCmdSingleFileAudio(
            path.join(
              argvUtils.getArgv()['outputDir'],
              configUser.getConfig().file.outputSubPath.assets,
              configUser.getConfig().file.assetUnityInternalPathDir,
              assetEntries[i]!.name,
            ),
          );
          cmdLineArray.push(cmdLineEntry);
        })().then(async () => {
          processedAssetEntry.push(assetEntries[i]!);
          activeProcessingCount--;
          progressBar?.increment(1, {
            name: assetEntries[i + 1] ? assetEntries[i + 1]!.name : assetEntries[i]!.name,
            ...progressBarFormatter(processedAssetEntry.length, assetEntries.length),
          });
          if (activeProcessingCount < argvUtils.getArgv()['threadProcessing']) {
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
      argvUtils.getArgv()['noShowProgress'] === false
        ? new cliProgress.SingleBar({
            format: '{bar} {percentageFmt}% | {valueFmt} / {totalFmt} proc | {duration_formatted} / {eta_formatted}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    const progressBarFormatter = (currentValue: number, totalValue: number) => {
      return {
        percentageFmt: mathUtils.rounder('ceil', (currentValue / totalValue) * 100, 2).padded.padStart(6, ' '),
        valueFmt: String(currentValue).padStart(String(totalValue).length, ' '),
        totalFmt: String(totalValue).padStart(String(totalValue).length, ' '),
      };
    };
    const processedCmdEntry: { command: string; args: string[] }[][] = [];
    progressBar?.start(
      cmdLineArray.length,
      processedCmdEntry.length,
      progressBarFormatter(processedCmdEntry.length, cmdLineArray.length),
    );
    let activeProcessingCount = 0;
    const processEmitter = new EventEmitter();
    const waitForAvailableThread = async () => {
      if (activeProcessingCount < argvUtils.getArgv()['threadProcessing']) {
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
        for (const cmdLnEntry of cmdLineArray[i]!) {
          await subProcessUtils.spawnAsync(cmdLnEntry.command, cmdLnEntry.args, {}, false);
        }
      })().then(async () => {
        processedCmdEntry.push(cmdLineArray[i]!);
        activeProcessingCount--;
        progressBar?.increment(1, progressBarFormatter(processedCmdEntry.length, cmdLineArray.length));
        if (activeProcessingCount < argvUtils.getArgv()['threadProcessing']) {
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
        await fs.rm(
          path.join(
            argvUtils.getArgv()['outputDir'],
            configUser.getConfig().file.outputSubPath.assets,
            configUser.getConfig().file.assetUnityInternalPathDir,
            entry.name,
          ),
        );
      }
      resolve();
    };
  });
}

function decryptABBuffer(inputBuffer: Buffer, key: Uint8Array): Buffer {
  const data = Buffer.from(inputBuffer);
  if (data.length <= 256) return data;
  for (let i = 256; i < data.length; i++) {
    data[i]! ^= key[i % key.length]!;
  }
  return data;
}

function generateABDecryptionKey(plainKey: bigint): Uint8Array | null {
  const baseKeys = hexToUint8Array(appConfig.cipher.assetBundle.baseKey);
  const baseLen = baseKeys.length; // should be 11
  const keys = new Uint8Array(baseLen * 8);
  const keyBytes = new Uint8Array(8);
  const view = new DataView(keyBytes.buffer);
  view.setBigUint64(0, plainKey, true);
  for (let i = 0; i < baseLen; ++i) {
    const b = baseKeys[i]!;
    const baseOffset = i << 3; // i * 8
    for (let j = 0; j < 8; ++j) {
      keys[baseOffset + j] = b ^ keyBytes[j]!;
    }
  }
  return keys;
}

function hexToUint8Array(hex: string): Uint8Array {
  const trimmed = hex.replace(/^0x/, '');
  if (trimmed.length % 2 !== 0) throw new Error('Invalid hex string length');
  return new Uint8Array(trimmed.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
}

async function assetsFileExistsCheck(assetDb: TypesAssetEntry.AssetDbConvertedEntry[]) {
  const retArray: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[] = [];
  logger.info('Checking for the existence of all asset files ...');
  const gameAssetFilePaths = await fileUtils.getFileList(configUser.getConfig().file.gameAssetDirPath!);
  const gameAssetFilesBasename = new Set(gameAssetFilePaths.map((filePath) => path.basename(filePath)));
  for (const assetDbEntry of assetDb) {
    const isFileExists = gameAssetFilesBasename.has(assetDbEntry.hash);
    retArray.push({ ...assetDbEntry, isFileExists });
  }
  return retArray;
}

async function TEST_deleteRandomAssets(count: number) {
  //! TEST PURPOSES ONLY !!!!
  const db = (await dbUtils.getDb()).assetDb.filter((el) => el.isFileExists);
  if (count > db.length) throw new Error(`Too many files to delete. Expected: <=${db.length}`);
  const getRandomElements = <T>(array: T[], count: number): T[] => {
    const arr = [...array];
    const length = arr.length;
    const resultCount = Math.min(count, length);
    let currentIndex = length;
    const endIndex = length - resultCount;
    while (currentIndex-- > endIndex) {
      const randomIndex = Math.floor(Math.random() * (currentIndex + 1));
      [arr[currentIndex]!, arr[randomIndex]!] = [arr[randomIndex]!, arr[currentIndex]!];
    }
    return arr.slice(endIndex);
  };
  const randomAssets = getRandomElements(db, count);
  logger.debug(chalk.red(`[TEST] Deleting ${count} exists files ...`));
  for (const assetEntry of randomAssets) {
    await fs.rm(path.join(configUser.getConfig().file.gameAssetDirPath!, assetEntry.hash.slice(0, 2), assetEntry.hash));
  }
  await dbUtils.loadAllDb(false);
}

export default {
  extractUnityAssetBundles,
  extractCriAudioAssets,
  assetsFileExistsCheck,
  TEST_deleteRandomAssets,
};
