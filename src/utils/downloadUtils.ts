import fs from 'node:fs';
import path from 'node:path';
import EventEmitter from 'node:events';
import * as uuid from 'uuid';
import cliProgress from 'cli-progress';
import { DateTime } from 'luxon';
import axios, { AxiosResponse } from 'axios';
import ky from 'ky';
import retry from 'async-retry';
import lz4 from 'lz4-napi';
import appConfig from './config.js';
import logger from './logger.js';
import argvUtils from './argv.js';
import waitUtils from './waitUtils.js';
import mathUtils from './mathUtils.js';

import * as TypesAssetEntry from '../types/AssetEntry.js';

async function downloadMissingAssets(
  assetDb: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }>,
  forceOverwrite: boolean,
) {
  // console.log(assetDb);
  const needDownloadAssetEntries =
    forceOverwrite === true ? assetDb : assetDb.filter((entry) => entry.isFileExists === false);

  if (needDownloadAssetEntries.length > 0)
    await new Promise<void>(async (resolve) => {
      logger.info(
        forceOverwrite === true ? 'Force downloading asset files ...' : 'Downloading missing asset files ...',
      );
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
              format: '{bar} {percentage}% | {value}/{total} files | {duration_formatted}/{eta_formatted}',
            })
          : null;

      let activeDownloadsCount = 0;
      const downloadedFileEntry: Array<TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean }> = new Array();
      const downloadEmitter = new EventEmitter();
      const waitForAvailableThread = async () => {
        if (activeDownloadsCount < argvUtils.getArgv().thread) {
          return;
        }
        await new Promise((resolve) => {
          downloadEmitter.once('threadAvailable', resolve);
        });
      };

      for (let i = 0; i < needDownloadAssetEntries.length; i++) {
        const entryObj = needDownloadAssetEntries[i];
        await waitForAvailableThread();
        activeDownloadsCount++;
        const connectionTimeStart = process.hrtime();
        (async () => {
          const dlUrl = (() => {
            let endpoint = appConfig.network.assetApi.endpoint.assetBundle;
            if (entryObj.kind !== null && ['master', 'sound', 'movie', 'font'].includes(entryObj.kind)) {
              endpoint = appConfig.network.assetApi.endpoint.generic;
            } else if (entryObj.kind !== null && entryObj.kind.includes('manifest')) {
              endpoint = appConfig.network.assetApi.endpoint.manifest;
            }
            return (
              'https://' +
              [
                appConfig.network.assetApi.baseDomain,
                appConfig.network.assetApi.apiPath,
                endpoint,
                entryObj.hash.slice(0, 2),
                entryObj.hash,
              ].join('/')
            );
          })();
          const progressTextFormatter = (currentValue: number, totalValue: number) => {
            return {
              percentageFormatted:
                currentValue > totalValue
                  ? '100.00'
                  : mathUtils.rounder('ceil', (currentValue / totalValue) * 100, 2).padded.padStart(6, ' '),
              valueFormatted: mathUtils.formatFileSizeFixedUnit(currentValue, 'MiB', 2).padStart(11, ' '),
              totalFormatted: mathUtils.formatFileSizeFixedUnit(totalValue, 'MiB', 2).padStart(11, ' '),
            };
          };
          await fs.promises.mkdir(path.join(appConfig.file.assetDir, entryObj.hash.slice(0, 2)), {
            recursive: true,
          });
          const writer = fs.createWriteStream(
            path.join(appConfig.file.assetDir, entryObj.hash.slice(0, 2), entryObj.hash),
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
          const response: AxiosResponse = await (async () => {
            return await retry(
              async () => {
                return await axios({
                  method: 'get',
                  url: dlUrl,
                  headers: {
                    'User-Agent': appConfig.network.userAgent.curlUnity,
                    'Cache-Control': 'no-cache',
                  },
                  timeout: appConfig.network.timeout,
                  responseType: 'stream',
                });
              },
              {
                retries: 10,
                factor: 2,
                minTimeout: 500,
                maxTimeout: Infinity,
                onRetry: (error: any, num) => {},
              },
            );
          })();
          response.data.on('data', (chunk: any) => {
            downloadedLength += chunk.length;
            subProgressBar?.increment(chunk.length);
            subProgressBar?.update(downloadedLength, {
              title: entryObj.name,
              ...progressTextFormatter(downloadedLength, entryObj.length),
            });
          });
          response.data.pipe(writer);
          response.data.on('end', () => {
            subProgressBar?.stop();
          });
          await new Promise<void>((resolve, reject) => {
            writer.on('finish', () => {
              subProgressBar !== null && progressBar !== null
                ? progressBar.remove(subProgressBar)
                : logger.debug(`Downloaded: ${entryObj.hash} ${entryObj.name}`);
              resolve();
            });
            writer.on('error', reject);
          });
          subOverallProgressBar?.increment();
        })().then(async () => {
          downloadedFileEntry.push(entryObj);
          activeDownloadsCount--;
          if (activeDownloadsCount < argvUtils.getArgv().thread) {
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

export default {
  downloadMissingAssets,
};
