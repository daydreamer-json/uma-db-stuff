import fs from 'node:fs';
import path from 'node:path';
import * as zstd from '@mongodb-js/zstd';
import bun from 'bun';
import cliProgress from 'cli-progress';
import { DateTime } from 'luxon';
import prompts from 'prompts';
import YAML from 'yaml';
import * as TypesAssetCsvStructure from '../types/AssetCsvStructure.js';
import argvUtils from '../utils/argv.js';
import assetsUtils from '../utils/assets.js';
import appConfig from '../utils/config.js';
import configUser from '../utils/configUser.js';
import dbUtils from '../utils/db.js';
import downloadUtils from '../utils/download.js';
import htmlBuildUtils from '../utils/htmlBuild.js';
import httpServerUtils from '../utils/httpServer.js';
import logger from '../utils/logger.js';
import mathUtils from '../utils/math.js';

async function mainCmdHandler() {
  const db = await dbUtils.getDb();
  const jsonlStringify = (input: object[]) => {
    return input.map((el) => JSON.stringify(el)).join('\n') + '\n';
  };
  logger.info('Exporting database to file ...');
  const dirObj = {
    root: path.join(argvUtils.getArgv()['outputDir'], configUser.getConfig().file.outputSubPath.db),
    master: {
      minJson: path.join(
        argvUtils.getArgv()['outputDir'],
        configUser.getConfig().file.outputSubPath.db,
        'master',
        'min-json',
      ),
      json: path.join(argvUtils.getArgv()['outputDir'], configUser.getConfig().file.outputSubPath.db, 'master', 'json'),
      jsonl: path.join(
        argvUtils.getArgv()['outputDir'],
        configUser.getConfig().file.outputSubPath.db,
        'master',
        'jsonl',
      ),
      yaml: path.join(argvUtils.getArgv()['outputDir'], configUser.getConfig().file.outputSubPath.db, 'master', 'yaml'),
    },
  };
  await (async () => {
    for (const dirPath of Object.values(dirObj.master)) {
      await fs.promises.mkdir(dirPath, { recursive: true });
    }
  })();
  const func = {
    exportAssetDb: async () => {
      logger.debug('Exporting assetDb ...');
      const strippedAssetDb = db.assetDb.map((obj) => {
        const { isFileExists, ...rest } = obj;
        return rest;
      });
      await bun.write(path.join(dirObj.root, 'asset.min.json'), JSON.stringify(strippedAssetDb));
      await bun.write(path.join(dirObj.root, 'asset.json'), JSON.stringify(strippedAssetDb, null, 2));
      await bun.write(path.join(dirObj.root, 'asset.jsonl'), jsonlStringify(strippedAssetDb));
    },
    exportMasterDb: async () => {
      //* Export masterDb
      logger.debug('Exporting masterDb ...');
      const tablesName = Object.keys(db.masterDb);
      const progressBar = !argvUtils.getArgv()['noShowProgress']
        ? new cliProgress.SingleBar({
            format: '{bar} {percentageFmt}% | {valueFmt} / {totalFmt} | {tableName}',
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
      let loadedCount = 0;
      progressBar?.start(tablesName.length, loadedCount, {
        tableName: tablesName[loadedCount],
        ...progressBarFormatter(loadedCount, tablesName.length),
      });
      for (const key of tablesName) {
        await bun.write(path.join(dirObj.master.minJson, key + '.min.json'), JSON.stringify(db.masterDb[key]));
        await bun.write(path.join(dirObj.master.json, key + '.json'), JSON.stringify(db.masterDb[key], null, 2));
        await bun.write(path.join(dirObj.master.jsonl, key + '.jsonl'), jsonlStringify(db.masterDb[key]));
        await bun.write(path.join(dirObj.master.yaml, key + '.yaml'), YAML.stringify(db.masterDb[key]));
        argvUtils.getArgv()['noShowProgress'] ? logger.trace(`Exported master database': '${key}'`) : null;
        loadedCount++;
        progressBar?.update(loadedCount, {
          tableName: tablesName[loadedCount] ?? '',
          ...progressBarFormatter(loadedCount, tablesName.length),
        });
      }
      progressBar?.stop();
    },
    exportMusicScores: async () => {
      if (true) {
        const regex = new RegExp(`^live/musicscores/.*$`, 'g');
        if (db.assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
          await downloadUtils.downloadMissingAssets(
            false,
            db.assetDb.filter((el) => el.name.match(regex)),
          );
          await dbUtils.loadAllDb(false);
        }
        await assetsUtils.extractUnityAssetBundles(
          (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
        );
      }
      const livesFiltered = db.masterDb['live_data'].filter((entry: any) => entry.has_live === 1);
      const outArr: {
        id: number;
        cyalume: TypesAssetCsvStructure.MusicscoreCyalumeOrig[];
        lyrics: TypesAssetCsvStructure.MusicscoreLyricsJson;
        part: TypesAssetCsvStructure.MusicscorePartJson;
      }[] = [];
      for (let i = 0; i < livesFiltered.length; i++) {
        const liveId = livesFiltered[i].music_id;
        outArr.push({
          id: liveId,
          cyalume: await bun
            .file(
              path.join(
                argvUtils.getArgv()['outputDir'],
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                `live/musicscores/m${liveId}/m${liveId}_cyalume.json`,
              ),
            )
            .json(),
          lyrics: await bun
            .file(
              path.join(
                argvUtils.getArgv()['outputDir'],
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                `live/musicscores/m${liveId}/m${liveId}_lyrics.json`,
              ),
            )
            .json(),
          part: await bun
            .file(
              path.join(
                argvUtils.getArgv()['outputDir'],
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                `live/musicscores/m${liveId}/m${liveId}_part.json`,
              ),
            )
            .json(),
        });
      }
      await bun.write(path.join(dirObj.root, 'musicscores.json'), JSON.stringify(outArr, null, 2));
    },
    exportHandbookV2: async () => {
      if (true) {
        const regex = new RegExp(
          `^(chara/chr.+?/chr_icon_round_[0-9]{4}|chara/chr.+?/chr_icon_[0-9]{4}|live/jacket/jacket_icon_l_[0-9]{4})$`,
          'g',
        );
        if (db.assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
          await downloadUtils.downloadMissingAssets(
            false,
            db.assetDb.filter((el) => el.name.match(regex)),
          );
          await dbUtils.loadAllDb(false);
        }
        await assetsUtils.extractUnityAssetBundles(
          (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
        );
      }
      if (true) {
        const regex = new RegExp(`^(sound/l/[0-9]{4}/.*_preview_|sound/v/snd_voi_outgame_[0-9]{4}01).*$`, 'g');
        if ((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
          await downloadUtils.downloadMissingAssets(
            false,
            (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
          );
          await dbUtils.loadAllDb(false);
        }
        await assetsUtils.extractCriAudioAssets((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)));
      }
      const transformedDb = {
        charas: db.masterDb['chara_data'].map((chara: any) => ({
          id: parseInt(chara.id),
          name: db.masterDb['text_data'].find((el: any) => el.id === 6 && el.category === 6 && el.index === chara.id)
            .text,
          actor: db.masterDb['text_data'].find((el: any) => el.id === 7 && el.category === 7 && el.index === chara.id)
            .text,
          sex: chara.sex === 1 ? 'M' : 'F',
          height: chara.height,
          bust: chara.bust,
          scale: chara.scale,
          skin: chara.skin,
          shape: chara.shape,
          socks: chara.socks,
          birthDate: (() => {
            if (chara.birth_year === 1800) {
              return (
                'xxxx/' + DateTime.fromObject({ month: chara.birth_month, day: chara.birth_day }).toFormat('MM/dd')
              );
            } else {
              return DateTime.fromObject({
                year: chara.birth_year,
                month: chara.birth_month,
                day: chara.birth_day,
              }).toFormat('yyyy/MM/dd');
            }
          })(),
          lastYear: chara.last_year === 1800 ? '-' : String(chara.last_year),
          availableAt: chara.start_date,
        })),
        lives: db.masterDb['live_data']
          .filter((live: any) => live.has_live === 1)
          .map((live: any) => ({
            id: parseInt(live.music_id),
            title: db.masterDb['text_data'].find(
              (el: any) => el.id === 16 && el.category === 16 && el.index === live.music_id,
            ).text,
            desc: db.masterDb['text_data']
              .find((el: any) => el.id === 128 && el.category === 128 && el.index === live.music_id)
              .text.replaceAll('\\n', '<br>'),
            credit: db.masterDb['text_data']
              .find((el: any) => el.id === 17 && el.category === 17 && el.index === live.music_id)
              .text.replaceAll('\\n', '<br>'),
            startAt: live.start_date,
            expireAt: live.end_date,
          })),
        liveAvail: db.masterDb['chara_data']
          .map((chara: any) => {
            const retObj: Record<string, any> = {
              id: chara.id,
              name: db.masterDb['text_data'].find(
                (el: any) => el.id === 6 && el.category === 6 && el.index === chara.id,
              ).text,
            };
            let canSing = false;
            db.masterDb['live_data']
              .filter((live: any) => live.has_live === 1)
              .forEach((live: any) => {
                retObj[String(live.music_id)] = (() => {
                  if (
                    (live.song_chara_type === 1 && chara.start_date < DateTime.now().toSeconds()) ||
                    db.masterDb['live_permission_data'].some(
                      (el: any) => el.music_id === live.music_id && el.chara_id === chara.id,
                    )
                  ) {
                    canSing = true;
                    return 1;
                  } else return 0;
                })();
              });
            if (canSing === false) return null;
            return retObj;
          })
          .filter((el: any) => el !== null),
        livePreviewLoopingInfo: await (async () => {
          const targetLiveIds: number[] = db.masterDb['live_data']
            .filter((live: any) => live.has_live === 1)
            .map((live: any) => live.music_id);
          const retArr = [];
          for (const liveId of targetLiveIds) {
            const loopingInfoResponse = (
              await bun
                .file(
                  path.join(
                    configUser.getConfig().file.outputPath,
                    configUser.getConfig().file.outputSubPath.assets,
                    configUser.getConfig().file.assetUnityInternalPathDir,
                    `sound/l/${liveId}/snd_bgm_live_${liveId}_preview_02.awb.json`,
                  ),
                )
                .json()
            )[0].loopingInfo;
            retArr.push([liveId, loopingInfoResponse.start, loopingInfoResponse.end]);
          }
          return retArr;
        })(),
        charaPreviewAudioSubsongInfo: await (async () => {
          const retArr = [];
          for (const chara of db.masterDb['chara_data']) {
            if (chara.start_date < DateTime.now().toSeconds()) {
              const rspJson = await bun
                .file(
                  path.join(
                    configUser.getConfig().file.outputPath,
                    configUser.getConfig().file.outputSubPath.assets,
                    configUser.getConfig().file.assetUnityInternalPathDir,
                    `sound/v/snd_voi_outgame_${chara.id}01.awb.json`,
                  ),
                )
                .json();
              retArr.push(rspJson.map((el: any) => el.streamInfo.name).findIndex((el: any) => el.match(/_0003$/g)));
            } else retArr.push(null);
          }
          return retArr;
        })(),
      };
      const compressedDbB64 = (await zstd.compress(Buffer.from(JSON.stringify(transformedDb), 'utf-8'), 20)).toString(
        'base64',
      );
      await bun.write(path.join(dirObj.root, 'handbook.html'), await htmlBuildUtils.buildHtml(compressedDbB64));
    },
  };
  await func.exportAssetDb();
  await func.exportMasterDb();
  await func.exportMusicScores();
  await func.exportHandbookV2();
  if (
    (
      await prompts({
        type: 'toggle',
        name: 'value',
        message: 'Do you want to open the generated handbook?',
        initial: true,
        active: 'yes',
        inactive: 'no',
      })
    ).value
  ) {
    await httpServerUtils.main();
  }
}

export default mainCmdHandler;
