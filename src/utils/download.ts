import fs from 'node:fs';
import bun from 'bun';
import path from 'node:path';
import EventEmitter from 'node:events';
import cliProgress from 'cli-progress';
import ky from 'ky';
// import * as lz4 from 'lz4-napi';
const lz4 = require('lz4-napi');
import logger from './logger';
import argvUtils from './argv';
import appConfig from './config';
import configUser from './configUser';
import mathUtils from './math';
import * as TypesAssetEntry from '../types/AssetEntry';
import dbUtils from './db';

async function downloadMissingAssets(
  forceOverwrite: boolean,
  customAssetDb: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[] | null = null,
): Promise<void> {
  const assetDb = customAssetDb ?? (await dbUtils.getDb()).assetDb;
  const needDownloadAssetEntries = forceOverwrite ? assetDb : assetDb.filter((el) => !el.isFileExists);
  if (needDownloadAssetEntries.length > 0)
    await new Promise<void>(async (resolve) => {
      // logger.info(
      //   forceOverwrite === true ? 'Force downloading asset files ...' : 'Downloading missing asset files ...',
      // );
      logger.info('Downloading asset files ...');
      const progressBar =
        argvUtils.getArgv().noShowProgress === false
          ? new cliProgress.MultiBar({
              format: 'Downloading {bar} {percentage}% | {value}/{total} files | {duration_formatted}/{eta_formatted}',
              ...appConfig.logger.progressBarConfig,
            })
          : null;
      const subOverallProgressBar =
        progressBar !== null
          ? progressBar.create(needDownloadAssetEntries.length, 0, null, {
              format:
                '{bar} {percentageFormatted}% | {valueFormatted} / {totalFormatted} files | {duration_formatted} / {eta_formatted}',
            })
          : null;
      let activeDownloadsCount = 0;
      const downloadedFileEntry: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }> = new Array();
      const downloadEmitter = new EventEmitter();
      const waitForAvailableThread = async () => {
        if (activeDownloadsCount < argvUtils.getArgv().threadNetwork) return;
        await new Promise((resolve) => downloadEmitter.once('threadAvailable', resolve));
      };
      for (let i = 0; i < needDownloadAssetEntries.length; i++) {
        const entryObj = needDownloadAssetEntries[i]!;
        await waitForAvailableThread();
        activeDownloadsCount++;
        const connectionTimeStart = process.hrtime();
        (async () => {
          const dlUrl = (() => {
            const endpoint = (() => {
              if (entryObj.kind !== null && ['master', 'sound', 'movie', 'font'].includes(entryObj.kind)) {
                return appConfig.network.assetApi.endpoint.generic;
              } else if (entryObj.kind !== null && entryObj.kind.includes('manifest')) {
                return appConfig.network.assetApi.endpoint.manifest;
              } else return appConfig.network.assetApi.endpoint.assetBundle;
            })();
            return [
              'https:/',
              appConfig.network.assetApi.baseDomain,
              appConfig.network.assetApi.apiPath,
              endpoint,
              entryObj.hash.slice(0, 2),
              entryObj.hash,
            ].join('/');
          })();
          const progressTextOverallFormatter = (currentValue: number, totalValue: number) => {
            return {
              percentageFormatted: mathUtils
                .rounder('ceil', (currentValue / totalValue) * 100, 2)
                .padded.padStart(6, ' '),
              valueFormatted: String(currentValue).padStart(8, ' '),
              totalFormatted: String(totalValue).padStart(8, ' '),
            };
          };
          const progressTextFormatter = (currentValue: number, totalValue: number) => {
            return {
              percentageFormatted:
                currentValue > totalValue
                  ? '100.00'
                  : mathUtils
                      .rounder('ceil', ((currentValue ?? 0) / (totalValue > 0 ? totalValue : 1)) * 100, 2)
                      .padded.padStart(6, ' '),
              valueFormatted: mathUtils.formatFileSizeFixedUnit(currentValue, 'MiB', 2).padStart(11, ' '),
              totalFormatted: mathUtils.formatFileSizeFixedUnit(totalValue, 'MiB', 2).padStart(11, ' '),
            };
          };
          await fs.promises.mkdir(path.join(configUser.getConfig().file.gameAssetDirPath!, entryObj.hash.slice(0, 2)), {
            recursive: true,
          });
          const writer = fs.createWriteStream(
            path.join(configUser.getConfig().file.gameAssetDirPath!, entryObj.hash.slice(0, 2), entryObj.hash),
          );
          let downloadedLength = 0;
          let subProgressBar =
            progressBar !== null
              ? progressBar.create(
                  entryObj.length,
                  downloadedLength,
                  {
                    title: entryObj.name,
                    ...progressTextFormatter(downloadedLength, entryObj.length),
                  },
                  {
                    format: '{bar} {percentageFormatted}% | {valueFormatted} / {totalFormatted} | {title}',
                  },
                )
              : null;
          const response = await ky.get(dlUrl, {
            headers: {
              'User-Agent': appConfig.network.userAgent.curlUnity,
              'Cache-Control': 'no-cache',
            },
            timeout: appConfig.network.timeout,
            retry: appConfig.network.retryCount,
          });
          if (!response.body) throw new Error('No stream available');
          const reader = response.body.getReader();
          const pump = async () => {
            const { done, value } = await reader.read();
            if (done) {
              subProgressBar?.stop();
              writer.end();
              return;
            }
            downloadedLength += value.length;
            subProgressBar?.increment(value.length);
            subProgressBar?.update(downloadedLength, {
              title: entryObj.name,
              ...progressTextFormatter(downloadedLength, entryObj.length),
            });
            writer.write(Buffer.from(value));
            await pump();
          };
          await pump();
          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => {
              subProgressBar !== null && progressBar !== null
                ? progressBar.remove(subProgressBar)
                : logger.debug(`Downloaded: ${entryObj.hash} ${entryObj.name}`);
              resolve();
            });
            writer.on('error', reject);
          });
          subOverallProgressBar?.update(
            downloadedFileEntry.length,
            progressTextOverallFormatter(downloadedFileEntry.length, needDownloadAssetEntries.length),
          );
        })().then(async () => {
          downloadedFileEntry.push(entryObj);
          activeDownloadsCount--;
          if (activeDownloadsCount < argvUtils.getArgv().threadNetwork) {
            downloadEmitter.emit('threadAvailable');
          }
          if (downloadedFileEntry.length === needDownloadAssetEntries.length) {
            await afterAllDownloadedFunc();
          }
        });
      }
      const afterAllDownloadedFunc = async () => {
        progressBar?.stop();
        // logger.info((forceOverwrite === true ? 'Force' : 'Missing') + ' assets downloaded');
        resolve();
      };
    });
}

async function forceDownloadMasterDb(): Promise<void> {
  logger.info('Force updating master database ...');
  const assetEntry = (await dbUtils.getDb()).assetDb.find(
    (entry) => entry.name.includes('master.mdb') && entry.kind === 'master',
  )!;
  await new Promise<void>(async (resolve) => {
    const dlUrl = [
      'https:/',
      appConfig.network.assetApi.baseDomain,
      appConfig.network.assetApi.apiPath,
      appConfig.network.assetApi.endpoint.generic,
      assetEntry.hash.slice(0, 2),
      assetEntry.hash,
    ].join('/');
    // console.log(assetEntry);
    const progressBar =
      argvUtils.getArgv().noShowProgress === false
        ? new cliProgress.SingleBar({
            format: '{bar} {percentageFormatted}% | {valueFormatted} / {totalFormatted}',
            ...appConfig.logger.progressBarConfig,
          })
        : null;
    const progressTextFormatter = (currentValue: number, totalValue: number) => {
      return {
        percentageFormatted:
          currentValue > totalValue
            ? '100.00'
            : mathUtils
                .rounder('ceil', ((currentValue ?? 0) / (totalValue > 0 ? totalValue : 1)) * 100, 2)
                .padded.padStart(6, ' '),
        valueFormatted: mathUtils.formatFileSizeFixedUnit(currentValue, 'MiB', 2).padStart(11, ' '),
        totalFormatted: mathUtils.formatFileSizeFixedUnit(totalValue, 'MiB', 2).padStart(11, ' '),
      };
    };
    let downloadedLength = 0;
    progressBar?.start(assetEntry.length, downloadedLength, progressTextFormatter(downloadedLength, assetEntry.length));
    await fs.promises.mkdir(path.join(configUser.getConfig().file.gameAssetDirPath!, assetEntry.hash.slice(0, 2)), {
      recursive: true,
    });
    const writer = fs.createWriteStream(
      path.join(configUser.getConfig().file.gameAssetDirPath!, assetEntry.hash.slice(0, 2), assetEntry.hash),
    );
    const response = await ky.get(dlUrl, {
      headers: {
        'User-Agent': appConfig.network.userAgent.curlUnity,
        'Cache-Control': 'no-cache',
      },
      timeout: appConfig.network.timeout,
      retry: appConfig.network.retryCount,
    });
    if (!response.body) throw new Error('No stream available');
    const reader = response.body.getReader();
    const pump = async () => {
      const { done, value } = await reader.read();
      if (done) {
        // progressBar?.stop();
        writer.end();
        return;
      }
      downloadedLength += value.length;
      progressBar?.increment(value.length);
      progressBar?.update(downloadedLength, progressTextFormatter(downloadedLength, assetEntry.length));
      writer.write(Buffer.from(value));
      await pump();
    };
    await pump();
    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => {
        progressBar?.stop();
        resolve();
      });
      writer.on('error', reject);
    });
    logger.debug('Downloaded master database');
    resolve();
  });
  const loadedBuffer = await bun
    .file(path.join(configUser.getConfig().file.gameAssetDirPath!, assetEntry.hash.slice(0, 2), assetEntry.hash))
    .arrayBuffer();
  const decompressedBuffer = await lz4.decompressFrame(Buffer.from(loadedBuffer));
  logger.debug('Decompressed database with LZ4');
  await bun.write(configUser.getConfig().file.sqliteDbPath.masterDb!, decompressedBuffer);
  await dbUtils.loadAllDb(true);
}

export default {
  downloadMissingAssets,
  forceDownloadMasterDb,
};
