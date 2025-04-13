import fs from 'node:fs';
import bun from 'bun';
import path from 'node:path';
import YAML from 'yaml';
import cliProgress from 'cli-progress';
import { DateTime } from 'luxon';
import appConfig from '../utils/config';
import configUser from '../utils/configUser';
import logger from '../utils/logger';
import dbUtils from '../utils/db';
import argvUtils from '../utils/argv';
import mathUtils from '../utils/math';
import exitUtils from '../utils/exit';
import markdownTableUtils from '../utils/markdownTable';
import downloadUtils from '../utils/download';
import assetsUtils from '../utils/assets';
import * as TypesAssetCsvStructure from '../types/AssetCsvStructure';

async function mainCmdHandler() {
  const db = await dbUtils.getDb();
  const jsonlStringify = (input: object[]) => {
    return input.map((el) => JSON.stringify(el)).join('\n') + '\n';
  };
  logger.info('Exporting database to file ...');
  const dirObj = {
    root: path.join(argvUtils.getArgv().outputDir, configUser.getConfig().file.outputSubPath.db),
    master: {
      minJson: path.join(
        argvUtils.getArgv().outputDir,
        configUser.getConfig().file.outputSubPath.db,
        'master',
        'min-json',
      ),
      json: path.join(argvUtils.getArgv().outputDir, configUser.getConfig().file.outputSubPath.db, 'master', 'json'),
      jsonl: path.join(argvUtils.getArgv().outputDir, configUser.getConfig().file.outputSubPath.db, 'master', 'jsonl'),
      yaml: path.join(argvUtils.getArgv().outputDir, configUser.getConfig().file.outputSubPath.db, 'master', 'yaml'),
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
      const progressBar = !argvUtils.getArgv().noShowProgress
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
        argvUtils.getArgv().noShowProgress ? logger.trace(`Exported master database': '${key}'`) : null;
        loadedCount++;
        progressBar?.update(loadedCount, {
          tableName: tablesName[loadedCount] ?? '',
          ...progressBarFormatter(loadedCount, tablesName.length),
        });
      }
      progressBar?.stop();
    },
    exportMusicScores: async () => {
      const livesFiltered = db.masterDb.live_data.filter((entry: any) => entry.has_live === 1);
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
                argvUtils.getArgv().outputDir,
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                `live/musicscores/m${liveId}/m${liveId}_cyalume.json`,
              ),
            )
            .json(),
          lyrics: await bun
            .file(
              path.join(
                argvUtils.getArgv().outputDir,
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                `live/musicscores/m${liveId}/m${liveId}_lyrics.json`,
              ),
            )
            .json(),
          part: await bun
            .file(
              path.join(
                argvUtils.getArgv().outputDir,
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
    exportHandbook: async () => {
      //* Export pretty handbook markdown
      // await (async () => {
      //   const regex = new RegExp(`^live/musicscores.*$`, 'g');
      //   if ((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
      //     await downloadUtils.downloadMissingAssets(
      //       false,
      //       (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
      //     );
      //     await dbUtils.loadAllDb(false);
      //   }
      //   await assetsUtils.extractUnityAssetBundles(
      //     (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
      //   );
      // })();
      logger.debug('Exporting handbook markdown ...');
      let outputMarkdownText: string = `# Uma Musume ID Handbook\n\nGenerated at: **${DateTime.now().toISO()}**\n\n`;
      outputMarkdownText += '## Characters\n\n';
      outputMarkdownText +=
        (() => {
          const arrArr: string[][] = [];
          arrArr.push([
            'ID',
            'Name',
            'Actor',
            'Sex',
            'Height',
            'Bust',
            'Scale',
            'Skin',
            'Shape',
            'Socks',
            'Birth Date',
            'Last Year',
            'Available At',
          ]);
          const isPadStartArray: (0 | 1 | 2)[] = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          for (let i = 0; i < db.masterDb.chara_data.length; i++) {
            const chara = db.masterDb.chara_data[i];
            arrArr.push([
              String(chara.id),
              db.masterDb.text_data.find((el: any) => el.id === 6 && el.category === 6 && el.index === chara.id).text,
              db.masterDb.text_data.find((el: any) => el.id === 7 && el.category === 7 && el.index === chara.id).text,
              chara.sex === 1 ? 'M' : 'F',
              String(chara.height),
              String(chara.bust),
              String(chara.scale),
              String(chara.skin),
              String(chara.shape),
              String(chara.socks),
              (() => {
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
              chara.last_year === 1800 ? '-' : String(chara.last_year),
              DateTime.fromSeconds(chara.start_date).toFormat('yyyy/MM/dd'),
            ]);
          }
          return markdownTableUtils.genTable(arrArr, isPadStartArray);
        })() + '\n\n';
      outputMarkdownText += '## Winning Live\n\n';
      const musicScores = await bun.file(path.join(dirObj.root, 'musicscores.json')).json();
      outputMarkdownText +=
        (() => {
          const arrArr: string[][] = [];
          arrArr.push(['ID', 'Title', 'Description', 'Available At', 'Expire At']);
          const isPadStartArray: (0 | 1 | 2)[] = [2, 0, 0, 0, 0];
          const livesFiltered = db.masterDb.live_data.filter((entry: any) => entry.has_live === 1);
          for (let i = 0; i < livesFiltered.length; i++) {
            const live = livesFiltered[i];
            arrArr.push([
              String(live.music_id),
              db.masterDb.text_data.find((el: any) => el.id === 16 && el.category === 16 && el.index === live.music_id)
                .text,
              db.masterDb.text_data
                .find((el: any) => el.id === 128 && el.category === 128 && el.index === live.music_id)
                .text.replaceAll('\\n', '<br>'),
              DateTime.fromSeconds(live.start_date).toFormat('yyyy/MM/dd'),
              DateTime.fromSeconds(live.end_date).toFormat('yyyy/MM/dd'),
            ]);
          }
          return markdownTableUtils.genTable(arrArr, isPadStartArray);
        })() + '\n\n';
      outputMarkdownText += '## Winning Live Chara Availability\n\n';
      outputMarkdownText +=
        (await (async () => {
          const arrArr: string[][] = [];
          const livesFiltered = db.masterDb.live_data.filter((entry: any) => entry.has_live === 1);
          arrArr.push(['Chara', ...livesFiltered.map((el: any) => String(el.music_id).split('').join('<br>'))]);
          const isPadStartArray: (0 | 1 | 2)[] = [2, ...Array.from({ length: livesFiltered.length }, () => 1 as const)];
          const filteredCharaData: number[] = db.masterDb.chara_data
            .filter((entry: any) => entry.start_date < DateTime.now().toSeconds())
            .map((entry: any) => entry.id);
          const allCharaData: number[] = db.masterDb.chara_data
            // .filter((entry: any) => entry.start_date < DateTime.now().toSeconds())
            .map((entry: any) => entry.id);
          const liveCharaAvailableArray: { liveId: number; charaIds: number[] }[] = (() => {
            const tmpArr: { liveId: number; charaIds: number[] }[] = [];
            for (let i = 0; i < livesFiltered.length; i++) {
              const liveId: number = livesFiltered[i]!.music_id;
              const songCharaType: number = livesFiltered[i]!.song_chara_type;
              if (songCharaType === 1) {
                // all charas available
                tmpArr.push({
                  liveId,
                  charaIds: [
                    ...filteredCharaData,
                    ...db.masterDb.live_permission_data
                      .filter((entry: any) => entry.music_id === liveId)
                      .map((entry: any) => entry.chara_id),
                  ],
                });
              } else if (songCharaType === 2) {
                // only some charas available
                tmpArr.push({
                  liveId,
                  charaIds: [
                    ...db.masterDb.live_permission_data
                      .filter((entry: any) => entry.music_id === liveId)
                      .map((entry: any) => entry.chara_id),
                  ],
                });
              }
            }
            return tmpArr;
          })();
          for (let i = 0; i < allCharaData.length; i++) {
            const charaId = allCharaData[i]!;
            const tmpArr: string[] = [String(charaId)];
            for (let j = 0; j < liveCharaAvailableArray.length; j++) {
              const liveCharaAvailObj = liveCharaAvailableArray[j]!;
              tmpArr.push(liveCharaAvailObj.charaIds.includes(charaId) ? '✅' : '❌');
            }
            if (
              JSON.stringify(tmpArr) !==
              JSON.stringify([String(charaId), ...Array.from({ length: liveCharaAvailableArray.length }, () => '❌')])
            ) {
              arrArr.push(tmpArr);
            }
          }
          return markdownTableUtils.genTable(arrArr, isPadStartArray);
        })()) + '\n\n';
      await bun.write(path.join(dirObj.root, 'handbook.md'), outputMarkdownText);
    },
  };
  // await func.exportAssetDb();
  // await func.exportMasterDb();
  await func.exportMusicScores();
  await func.exportHandbook();
}

export default mainCmdHandler;
