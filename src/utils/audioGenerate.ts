import bun from 'bun';
import fs from 'node:fs/promises';
import path from 'node:path';
import util from 'node:util';
import child_process from 'node:child_process';
import prompts from 'prompts';
import ffmpeg from 'fluent-ffmpeg';
import { DateTime } from 'luxon';
import chalk from 'chalk';
import logger from './logger';
import argvUtils from './argv';
import dbUtils from './db';
import appConfig from './config';
import configUser from './configUser';
import downloadUtils from './download';
import assetsUtils from './assets';
import mathUtils from './math';
import reaperUtils from './reaper';
import subProcessUtils from './subProcess';
import * as TypesAssetCsvStructure from '../types/AssetCsvStructure';
import configEmbed from './configEmbed';
const execPromise = util.promisify(child_process.exec);

async function askToUserLiveId(): Promise<number> {
  const db = (await dbUtils.getDb()).masterDb;
  const liveId = argvUtils.getArgv().liveId
    ? parseInt(argvUtils.getArgv().liveId)
    : (
        await prompts({
          type: 'select',
          name: 'value',
          message: 'Select live track',
          // initial: 0,
          choices: db.live_data
            .filter((entry: any) => entry.has_live === 1)
            .map((entry: any) => ({
              title:
                entry.music_id +
                ': ' +
                db.text_data.find(
                  (texEntry: any) =>
                    texEntry.id === 16 && texEntry.category === 16 && texEntry.index === entry.music_id,
                ).text,
              description: db.text_data
                .find(
                  (texEntry: any) =>
                    texEntry.id === 128 && texEntry.category === 128 && texEntry.index === entry.music_id,
                )
                .text.split('\\n')[0],
              value: parseInt(entry.music_id),
            })),
        })
      ).value;
  if (!db.live_data.find((entry: { [key: string]: any }) => entry.music_id === liveId)) {
    throw new Error(`live '${liveId}' not found`);
  }
  return liveId;
}

async function loadMusicScoreJson(liveId: number): Promise<{
  cyalume: TypesAssetCsvStructure.MusicscoreCyalumeOrig[];
  lyrics: TypesAssetCsvStructure.MusicscoreLyricsJson;
  part: TypesAssetCsvStructure.MusicscorePartJson;
}> {
  const db = await dbUtils.getDb();
  const filePaths = {
    cyalume: path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.assets,
      configUser.getConfig().file.assetUnityInternalPathDir,
      `live/musicscores/m${liveId}/m${liveId}_cyalume.json`,
    ),
    lyrics: path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.assets,
      configUser.getConfig().file.assetUnityInternalPathDir,
      `live/musicscores/m${liveId}/m${liveId}_lyrics.json`,
    ),
    part: path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.assets,
      configUser.getConfig().file.assetUnityInternalPathDir,
      `live/musicscores/m${liveId}/m${liveId}_part.json`,
    ),
  };
  if (
    !(
      (await bun.file(filePaths.cyalume).exists()) &&
      (await bun.file(filePaths.lyrics).exists()) &&
      (await bun.file(filePaths.part).exists())
    )
  ) {
    const regex = new RegExp(`^live/musicscores/m${liveId}.*$`, 'g');
    if (db.assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
      await downloadUtils.downloadMissingAssets(
        false,
        db.assetDb.filter((el) => el.name.match(regex)),
      );
      await dbUtils.loadAllDb(false);
    }
    await assetsUtils.extractUnityAssetBundles((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)));
  }
  return {
    cyalume: await bun.file(filePaths.cyalume).json(),
    lyrics: await bun.file(filePaths.lyrics).json(),
    part: await bun.file(filePaths.part).json(),
  };
}

async function askToUserCharaId(
  liveId: number,
  musicScoreData: {
    cyalume: TypesAssetCsvStructure.MusicscoreCyalumeOrig[];
    lyrics: TypesAssetCsvStructure.MusicscoreLyricsJson;
    part: TypesAssetCsvStructure.MusicscorePartJson;
  },
) {
  const db = await dbUtils.getDb();
  const liveCanUseCharaArray: number[] = (() => {
    const songCharaType = db.masterDb.live_data.find((entry: any) => entry.music_id === liveId).song_chara_type;
    if (songCharaType === 1) {
      // all charas available
      return [
        ...db.masterDb.chara_data
          .filter((entry: any) => entry.start_date < DateTime.now().toSeconds())
          .map((entry: any) => entry.id),
        ...db.masterDb.live_permission_data
          .filter((entry: any) => entry.music_id === liveId)
          .map((entry: any) => entry.chara_id),
      ];
    } else if (songCharaType === 2) {
      // only some charas available
      return db.masterDb.live_permission_data
        .filter((entry: any) => entry.music_id === liveId)
        .map((entry: any) => entry.chara_id);
    }
  })();
  const charaIds: Record<TypesAssetCsvStructure.MusicscorePartTrackString, number | null> = await (async () => {
    const availablePositionArray: string[] = Object.entries(musicScoreData.part.availableTrack)
      .filter((el) => el[1])
      .map((el) => el[0]);
    const selectedCharaArray: number[] = [];
    const questionBuilder = async (position: string) => {
      return (
        await prompts({
          type: 'select',
          name: 'value',
          message: `Select singing chara for '${position}' position`,
          choices: liveCanUseCharaArray
            // .filter((entry) => selectedCharaArray.includes(entry) === false) // to eliminate duplicates
            .map((entry) => ({
              title:
                entry +
                ': ' +
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === entry,
                ).text,
              description:
                'CV: ' +
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 7 && texEntry.category === 7 && texEntry.index === entry,
                ).text,
              value: entry,
              disabled: false,
              selected: false,
            })),
        })
      ).value;
    };
    if (argvUtils.getArgv().charaIds) {
      const argParsed = (() => {
        const orig: (number | null)[] = argvUtils
          .getArgv()
          .charaIds.trim()
          .replace(/,$/, '')
          .split(',')
          .map((str: string) => parseInt(str))
          .map((el: number) => {
            if (liveCanUseCharaArray.includes(el)) return el;
            else return null;
          });
        const validated = orig.filter((el) => el !== null);
        return validated;
      })();
      if (argParsed.length !== availablePositionArray.length)
        throw new Error('The number of charaIds passed on the CLI does not match the number of positions available');
      const retObj: Record<string, number | null> = {
        left3: null,
        left2: null,
        left: null,
        center: null,
        right: null,
        right2: null,
        right3: null,
      };
      for (let i = 0; i < availablePositionArray.length; i++) {
        const position = availablePositionArray[i]!;
        retObj[position] = argParsed[i]!;
        selectedCharaArray.push(argParsed[i]!);
      }

      return retObj;
    } else {
      console.log(`Available positions: ${availablePositionArray.map((el) => chalk.bold.green(el)).join(', ')}`);
      const retObj: Record<string, number | null> = {
        left3: null,
        left2: null,
        left: null,
        center: null,
        right: null,
        right2: null,
        right3: null,
      };
      for (let i = 0; i < availablePositionArray.length; i++) {
        const rsp = await questionBuilder(availablePositionArray[i]!);
        selectedCharaArray.push(rsp);
        retObj[availablePositionArray[i]!] = rsp;
      }
      return retObj;
    }
  })();
  console.log(
    'Mapped to: ' +
      Object.entries(charaIds)
        .filter((el) => el[1] !== null)
        .map(
          (el) =>
            `${chalk.bold.cyan(el[0].padEnd(6))} -> ${el[1]}: ${chalk.bold.green(
              db.masterDb.text_data.find(
                (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === el[1],
              ).text,
            )} ${chalk.gray(
              '(CV: ' +
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 7 && texEntry.category === 7 && texEntry.index === el[1],
                ).text +
                ')',
            )}`,
        )
        .join('\n           '),
  );
  return charaIds;
}

async function generateMain() {
  const db = await dbUtils.getDb();
  const userInputLiveId = await askToUserLiveId();
  const musicScoreData = await loadMusicScoreJson(userInputLiveId);
  const selectedSingChara = await askToUserCharaId(userInputLiveId, musicScoreData);
  await processAudio(userInputLiveId, musicScoreData, selectedSingChara);
}

async function processAudio(
  liveId: number,
  musicScoreData: {
    cyalume: TypesAssetCsvStructure.MusicscoreCyalumeOrig[];
    lyrics: TypesAssetCsvStructure.MusicscoreLyricsJson;
    part: TypesAssetCsvStructure.MusicscorePartJson;
  },
  selectedSingChara: Record<TypesAssetCsvStructure.MusicscorePartTrackString, number | null>,
) {
  const isOkeCheers: boolean = false;
  const okeMetadataJsonPath = path.join(
    argvUtils.getArgv().outputDir,
    configUser.getConfig().file.outputSubPath.assets,
    configUser.getConfig().file.assetUnityInternalPathDir,
    `sound/l/${liveId}/snd_bgm_live_${liveId}_oke_${isOkeCheers ? '01' : '02'}.awb.json`,
  );
  if (!(await bun.file(okeMetadataJsonPath).exists())) {
    const regex = new RegExp(`^sound/l/${liveId}/snd_bgm_live_${liveId}_(oke|preview).*$`, 'g');
    if ((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
      await downloadUtils.downloadMissingAssets(
        false,
        (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
      );
      await dbUtils.loadAllDb(false);
    }
    await assetsUtils.extractCriAudioAssets((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)));
  }
  await (async () => {
    const fileNotFoundChara = await (async () => {
      const arr: number[] = [];
      for (const charaId of Object.values(selectedSingChara).filter((el) => el !== null)) {
        if (
          !(await bun
            .file(
              path.join(
                argvUtils.getArgv().outputDir,
                configUser.getConfig().file.outputSubPath.assets,
                configUser.getConfig().file.assetUnityInternalPathDir,
                `sound/l/${liveId}/snd_bgm_live_${liveId}_chara_${charaId}_01.awb.json`,
              ),
            )
            .exists())
        )
          arr.push(charaId);
      }
      return arr;
    })();
    if (fileNotFoundChara.length > 0) {
      const regex = new RegExp(
        `^sound/l/${liveId}/snd_bgm_live_${liveId}_chara_(${fileNotFoundChara.join('|')}).*$`,
        'g',
      );
      if ((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
        await downloadUtils.downloadMissingAssets(
          false,
          (await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)),
        );
        await dbUtils.loadAllDb(false);
      }
      await assetsUtils.extractCriAudioAssets((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)));
    }
  })();
  const db = await dbUtils.getDb();
  ffmpeg.setFfmpegPath(path.resolve(appConfig.file.cliPath.ffmpeg));
  await fs.rm(
    path.join(argvUtils.getArgv().outputDir, configUser.getConfig().file.outputSubPath.renderedAudio, 'tmp'),
    { recursive: true, force: true },
  );
  const positionList = Object.entries(musicScoreData.part.availableTrack)
    .filter((el) => el[1])
    .map((el) => el[0]) as TypesAssetCsvStructure.MusicscorePartTrackString[];
  const okeMetadataJson = await bun.file(okeMetadataJsonPath).json();
  const liveSongDurationMs = Math.ceil((okeMetadataJson[0].numberOfSamples / okeMetadataJson[0].sampleRate) * 1000);
  const timeStartEndArray: { startMs: number; endMs: number }[] = (() => {
    const tmpArr = new Array();
    for (let i = 0; i < musicScoreData.part.part.length; i++) {
      tmpArr.push({
        startMs: musicScoreData.part.part[i]!.timeMs,
        endMs: musicScoreData.part.part[i + 1] ? musicScoreData.part.part[i + 1]!.timeMs : -1,
      });
    }
    return tmpArr;
  })();
  const subSongCount = mathUtils.arrayMax(
    musicScoreData.part.part.map((entry) => mathUtils.arrayMax(Object.values(entry.tracks))),
  );

  //* ===== Extract original audio segments (split) =====
  logger.info(chalk.gray('[Live Audio] ') + 'Extracting audio segments ...');
  await fs.mkdir(
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      'split_orig',
    ),
    { recursive: true },
  );
  for (const positionKey of positionList) {
    for (const timeStartEndEntry of timeStartEndArray) {
      for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
        await new Promise((resolve, reject) => {
          ffmpeg(
            path.join(
              argvUtils.getArgv().outputDir,
              configUser.getConfig().file.outputSubPath.assets,
              configUser.getConfig().file.assetUnityInternalPathDir,
              `sound/l/${liveId}`,
              subSongCount > 1
                ? `snd_bgm_live_${liveId}_chara_${selectedSingChara[positionKey]}_01_awb/${String(subSongIndex).padStart(8, '0')}_snd_bgm_live_${liveId}_chara_${selectedSingChara[positionKey]}_01.flac`
                : `snd_bgm_live_${liveId}_chara_${selectedSingChara[positionKey]}_01.awb.flac`,
              // `snd_bgm_live_${liveId}_oke_02.awb.flac`,
            ),
          )
            .setStartTime(timeStartEndEntry.startMs / 1000)
            .setDuration(
              timeStartEndEntry.endMs === -1 ? 3600 : (timeStartEndEntry.endMs - timeStartEndEntry.startMs) / 1000,
            )
            .audioCodec('pcm_f32le')
            .output(
              path.join(
                argvUtils.getArgv().outputDir,
                configUser.getConfig().file.outputSubPath.renderedAudio,
                'tmp',
                'split_orig',
                `l${liveId}_${positionKey}_c${selectedSingChara[positionKey]}_s${subSongIndex}_${timeStartEndEntry.startMs}-${timeStartEndEntry.endMs}.wav`,
              ),
            )
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      }
    }
  }

  //* ===== Process volume pan filter to all segments =====
  logger.info(chalk.gray('[Live Audio] ') + 'Processing audio segments ...');
  await fs.mkdir(
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      'split_processed',
    ),
    {
      recursive: true,
    },
  );
  for (const positionKey of positionList) {
    for (const [partIndex, partEntry] of Object.entries(musicScoreData.part.part)) {
      for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
        await (async () => {
          const polyphonyCount = Object.values(partEntry.tracks).filter((el) => el === subSongIndex + 1).length;
          const volumeNormFactor = Math.sqrt(1 / Math.max(1, polyphonyCount));
          const volumeValue =
            partEntry.tracksEnable[positionKey] === true
              ? partEntry.tracks[positionKey] === subSongIndex + 1
                ? mathUtils.rounder(
                    'round',
                    partEntry.volume[positionKey] === 999 || partEntry.volume[positionKey] === null
                      ? volumeNormFactor
                      : partEntry.volume[positionKey],
                    3,
                  ).orig
                : 0
              : 0;
          const panValue =
            partEntry.tracksEnable[positionKey] === true
              ? partEntry.tracks[positionKey] === subSongIndex + 1
                ? partEntry.pan[positionKey] === 999 || partEntry.pan[positionKey] === null
                  ? 0
                  : partEntry.pan[positionKey]
                : 0
              : 0;
          const panGainValueForFfmpeg = {
            left: panValue <= 0 ? 1 : 1 - panValue,
            right: panValue >= 0 ? 1 : 1 + panValue,
          };
          await new Promise((resolve, reject) => {
            ffmpeg(
              path.join(
                argvUtils.getArgv().outputDir,
                configUser.getConfig().file.outputSubPath.renderedAudio,
                'tmp',
                'split_orig',
                `l${liveId}_${positionKey}_c${selectedSingChara[positionKey]}_s${subSongIndex}_${timeStartEndArray[parseInt(partIndex)]!.startMs}-${timeStartEndArray[parseInt(partIndex)]!.endMs}.wav`,
              ),
            )
              .audioFilters([
                { filter: 'volume', options: volumeValue.toString() },
                {
                  filter: 'pan',
                  options: `stereo|c0=${panGainValueForFfmpeg.left}*c0|c1=${panGainValueForFfmpeg.right}*c1`,
                },
              ])
              .audioCodec('pcm_f32le')
              .output(
                path.join(
                  argvUtils.getArgv().outputDir,
                  configUser.getConfig().file.outputSubPath.renderedAudio,
                  'tmp',
                  'split_processed',
                  `l${liveId}_${positionKey}_c${selectedSingChara[positionKey]}_s${subSongIndex}_${timeStartEndArray[parseInt(partIndex)]!.startMs}-${timeStartEndArray[parseInt(partIndex)]!.endMs}.wav`,
                ),
              )
              .on('end', resolve)
              .on('error', reject)
              .run();
          });
        })();
      }
    }
  }
  await fs.rm(
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      'split_orig',
    ),
    {
      recursive: true,
      force: true,
    },
  );

  //* ===== Concat all processed segments =====
  logger.info(chalk.gray('[Live Audio] ') + 'Compositing processed segments ...');
  for (const positionKey of positionList) {
    await fs.mkdir(
      path.join(
        argvUtils.getArgv().outputDir,
        configUser.getConfig().file.outputSubPath.renderedAudio,
        'tmp',
        'concat_processed',
      ),
      {
        recursive: true,
      },
    );
    for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
      await (async () => {
        const inputFiles = timeStartEndArray.map((entry) => {
          return path.join(
            argvUtils.getArgv().outputDir,
            configUser.getConfig().file.outputSubPath.renderedAudio,
            'tmp',
            'split_processed',
            `l${liveId}_${positionKey}_c${selectedSingChara[positionKey]}_s${subSongIndex}_${entry.startMs}-${entry.endMs}.wav`,
          );
        });
        await new Promise((resolve, reject) => {
          const ffmpegCommand = ffmpeg();
          inputFiles.forEach((filePath) => ffmpegCommand.input(filePath));
          ffmpegCommand
            .complexFilter([
              {
                filter: 'concat',
                options: {
                  n: inputFiles.length,
                  v: 0,
                  a: 1,
                },
              },
            ])
            .audioCodec('pcm_f32le')
            .output(
              path.join(
                argvUtils.getArgv().outputDir,
                configUser.getConfig().file.outputSubPath.renderedAudio,
                'tmp',
                'concat_processed',
                `l${liveId}_${positionKey}_c${selectedSingChara[positionKey]}_s${subSongIndex}.wav`,
              ),
            )
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      })();
    }
  }
  await fs.rm(
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      'split_processed',
    ),
    {
      recursive: true,
      force: true,
    },
  );

  //* ===== Mix all audio tracks =====
  logger.info(chalk.gray('[Live Audio] ') + 'Mixing audio tracks ...');
  await (async () => {
    const inputFiles: string[] = [];
    inputFiles.push(
      path.join(
        argvUtils.getArgv().outputDir,
        configUser.getConfig().file.outputSubPath.assets,
        configUser.getConfig().file.assetUnityInternalPathDir,
        `sound/l/${liveId}/snd_bgm_live_${liveId}_oke_${isOkeCheers ? '01' : '02'}.awb.flac`,
      ),
    );
    for (const positionKey of positionList) {
      for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
        inputFiles.push(
          path.join(
            argvUtils.getArgv().outputDir,
            configUser.getConfig().file.outputSubPath.renderedAudio,
            'tmp',
            'concat_processed',
            `l${liveId}_${positionKey}_c${selectedSingChara[positionKey]}_s${subSongIndex}.wav`,
          ),
        );
      }
    }
    await new Promise((resolve, reject) => {
      const volumeBoost = inputFiles.length;
      const ffmpegCommand = ffmpeg();
      inputFiles.forEach((filePath) => ffmpegCommand.input(filePath));
      ffmpegCommand
        .complexFilter(
          inputFiles
            .map(
              (_, index) =>
                `[${index}:a]volume=${volumeBoost},volume=${
                  index === 0
                    ? Math.pow(10, configUser.getConfig().audio.volumeCompensation.inst / 20)
                    : Math.pow(10, configUser.getConfig().audio.volumeCompensation.vocal / 20)
                }[a${index}]`,
            )
            .join(';') +
            ';' +
            inputFiles.map((_, index) => `[a${index}]`).join('') +
            `amix=inputs=${inputFiles.length}:duration=longest:dropout_transition=2147483647[aout]`,
        )
        .audioCodec('pcm_f32le')
        .outputOptions(['-map [aout]'])
        .output(
          path.join(
            argvUtils.getArgv().outputDir,
            configUser.getConfig().file.outputSubPath.renderedAudio,
            'tmp',
            `l${liveId}_mix_raw.wav`,
          ),
        )
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  })();
  await fs.rm(
    path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      'concat_processed',
    ),
    {
      recursive: true,
      force: true,
    },
  );

  const baseFilename = `${liveId}_${
    db.masterDb.text_data.find(
      (texEntry: any) => texEntry.id === 16 && texEntry.category === 16 && texEntry.index === liveId,
    ).text
  }_${TypesAssetCsvStructure.musicScorePartTrackStringSortedArray
    .map((key) => selectedSingChara[key])
    .filter((val): val is number => val !== null)
    .map(
      (entry) =>
        db.masterDb.text_data.find(
          (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === entry,
        ).text,
    )
    .join('_')}`;

  //* ===== Mastering mixed audio =====
  logger.info(chalk.gray('[Live Audio] ') + 'Mastering audio track ...');
  await (async () => {
    logger.debug(chalk.gray('[Live Audio] ') + 'Calculating premaster loudness ...');
    const premasterLoudnessStats = await (async () => {
      let outputRow = '';
      await new Promise((resolve, reject) => {
        ffmpeg(
          path.join(
            argvUtils.getArgv().outputDir,
            configUser.getConfig().file.outputSubPath.renderedAudio,
            'tmp',
            `l${liveId}_mix_raw.wav`,
          ),
        )
          .audioFilter('loudnorm=print_format=json')
          .outputFormat('null')
          .output('/dev/null')
          .on('stderr', (stderrLine) => {
            outputRow += stderrLine;
          })
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      const jsonStartIndex = outputRow.indexOf('{');
      const jsonEndIndex = outputRow.lastIndexOf('}');
      const jsonString = outputRow.slice(jsonStartIndex, jsonEndIndex + 1);
      return JSON.parse(jsonString);
    })();
    logger.debug(
      chalk.gray('[Live Audio] ') + 'Calculated premaster loudness: ' + premasterLoudnessStats.input_i + ' dB',
    );
    await bun.write(
      bun.file(
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_orig_' + baseFilename + '.wav',
        ),
      ),
      bun.file(
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'tmp',
          `l${liveId}_mix_raw.wav`,
        ),
      ),
    );
    logger.debug(
      chalk.gray('[Live Audio] ') +
        'Applying loudness normalization: ' +
        mathUtils.rounder(
          'round',
          configUser.getConfig().audio.targetLoudness - parseFloat(premasterLoudnessStats.input_i),
          2,
        ).padded +
        ' dB',
    );
    if (configUser.getConfig().audio.useVSTLimiter) {
      await reaperUtils.reaperCleaning();
      await reaperUtils.tr5StealthLimiter_runPlugin(
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'tmp',
          `l${liveId}_mix_raw.wav`,
        ),
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.wav',
        ),
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'tmp',
          `reaper_batch.conf`,
        ),
        {
          input: configUser.getConfig().audio.targetLoudness - parseFloat(premasterLoudnessStats.input_i),
          output: -0.05,
        },
      );
      await reaperUtils.reaperCleaning();
    } else {
      await subProcessUtils.spawnAsync(
        path.resolve(appConfig.file.cliPath.sox),
        [
          '--buffer',
          String(65536),
          '-G', // --guard
          '--multi-threaded',
          '--replay-gain',
          'off',
          '-S', // --show-progress
          '-V3', // verbosity
          path.join(
            argvUtils.getArgv().outputDir,
            configUser.getConfig().file.outputSubPath.renderedAudio,
            'tmp',
            `l${liveId}_mix_raw.wav`,
          ),
          '--bits',
          String(24),
          '--channels',
          String(2),
          '--encoding',
          'signed-integer',
          path.join(
            argvUtils.getArgv().outputDir,
            configUser.getConfig().file.outputSubPath.renderedAudio,
            'mix_norm_' + baseFilename + '.wav',
          ),
          'vol',
          configUser.getConfig().audio.targetLoudness - parseFloat(premasterLoudnessStats.input_i) + 'dB',
          'gain',
          '-l',
          'gain',
          String(-0.05),
        ],
        {},
        false,
      );
    }
    logger.debug(chalk.gray('[Live Audio] ') + 'Encoding mastered audio to FLAC ...');
    await subProcessUtils.spawnAsync(
      path.resolve(appConfig.file.cliPath.flac),
      [
        '--delete-input-file',
        '-f', // --force
        '-V', // --verify
        '-j', // --threads
        String(16),
        '-l', // --max-lpc-order
        String(12),
        '-b', // --blocksize
        String(4608),
        '-m', // --mid-side
        '-r', // --rice-partition-order
        String(8),
        '-A', // --apodization
        'subdivide_tukey(5)',
        '-o',
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.flac',
        ),
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.wav',
        ),
      ],
      {},
      false,
    );
  })();

  const jacketAssetPath = path.join(
    argvUtils.getArgv().outputDir,
    configUser.getConfig().file.outputSubPath.assets,
    configUser.getConfig().file.assetUnityInternalPathDir,
    `live/jacket/jacket_icon_l_${liveId}.png`,
  );

  //* ===== Add metadata to mastered audio =====
  await (async () => {
    // logger.debug(chalk.gray('[Live Audio] ') + 'Writing metadata to mastered audio ...');

    // const jacketCompressedPath = path.join(
    //   argvUtils.getArgv().outputDir,
    //   configUser.getConfig().file.outputSubPath.renderedAudio,
    //   'tmp',
    //   `jacket_compressed.jpg`,
    // );
    const metaFlacInputTextPath = path.join(
      argvUtils.getArgv().outputDir,
      configUser.getConfig().file.outputSubPath.renderedAudio,
      'tmp',
      `metaflac_input.txt`,
    );
    if (!(await bun.file(jacketAssetPath).exists())) {
      const regex = new RegExp(`^live/jacket/jacket_icon_l.*$`, 'g');
      if (db.assetDb.filter((el) => el.name.match(regex) && !el.isFileExists).length > 0) {
        await downloadUtils.downloadMissingAssets(
          false,
          db.assetDb.filter((el) => el.name.match(regex)),
        );
        await dbUtils.loadAllDb(false);
      }
      await assetsUtils.extractUnityAssetBundles((await dbUtils.getDb()).assetDb.filter((el) => el.name.match(regex)));
    }
    const metaflacInputTextObj: [string, string][] = [
      [
        'TITLE',
        db.masterDb.text_data.find(
          (texEntry: any) => texEntry.id === 16 && texEntry.category === 16 && texEntry.index === liveId,
        ).text as string,
      ],
      ['ALBUMARTIST', 'Various Artists'],
      ...TypesAssetCsvStructure.musicScorePartTrackStringSortedArray
        .map((key) => selectedSingChara[key])
        .filter((val): val is number => val !== null)
        .map(
          (entry) =>
            [
              'ARTIST',
              `${
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === entry,
                ).text
              } (CV: ${
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 7 && texEntry.category === 7 && texEntry.index === entry,
                ).text
              })` as string,
            ] as [string, string],
        ),
      // ...Object.values(selectedSingChara)
      //   .filter((entry) => entry !== null)
      //   .map(
      //     (entry) =>
      //       [
      //         'ARTIST',
      //         `${
      //           db.masterDb.text_data.find(
      //             (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === entry,
      //           ).text
      //         } (CV: ${
      //           db.masterDb.text_data.find(
      //             (texEntry: any) => texEntry.id === 7 && texEntry.category === 7 && texEntry.index === entry,
      //           ).text
      //         })` as string,
      //       ] as [string, string],
      //   ),
      ...(() => {
        const latestUnix = mathUtils.arrayMax([
          db.masterDb.live_data.find((entry: any) => entry.music_id === liveId).start_date as number,
          ...Object.values(selectedSingChara)
            .filter((entry) => entry !== null)
            .map((charaId) => db.masterDb.chara_data.find((el: any) => el.id === charaId).start_date as number),
        ]);
        const latestDateTime = DateTime.fromSeconds(latestUnix);
        return [
          ['YEAR', String(latestDateTime.toObject().year)],
          ['YEAR', latestDateTime.toISODate()],
          ['DATE', latestDateTime.toISODate()],
        ] as [string, string][];
      })(),
      // [
      //   'LYRICS',
      //   (
      //     await bun
      //       .file(
      //         path.join(
      //           argvUtils.getArgv().outputDir,
      //           configUser.getConfig().file.outputSubPath.assets,
      //           configUser.getConfig().file.assetUnityInternalPathDir,
      //           `live/musicscores/m${liveId}/m${liveId}_lyrics.lrc`,
      //         ),
      //       )
      //       .text()
      //   ).replaceAll('\n', '\\n'),
      // ],
      ['LABEL', 'Lantis'],
      ['COPYRIGHT', '(C) Cygames, Inc.'],
      ['COMMENT', `Generated by ${configEmbed.APPLICATION_NAME} tool`],
      ['ENCODEDBY', `${configEmbed.APPLICATION_NAME} v${configEmbed.VERSION_NUMBER}`],
      ['ENCODERSETTINGS', `${JSON.stringify(configUser.getConfig().audio)}`],
    ];
    await bun.write(metaFlacInputTextPath, metaflacInputTextObj.map((el) => `${el[0]}=${el[1]}`).join('\r\n') + '\r\n');
    // await bun.write(
    //   jacketCompressedPath,
    //   await sharp(await bun.file(jacketAssetPath).bytes())
    //     .jpeg({ quality: 100, mozjpeg: true })
    //     .toBuffer(),
    // );
    await subProcessUtils.spawnAsync(
      path.resolve(appConfig.file.cliPath.metaflac),
      [
        '--no-utf8-convert',
        '--add-replay-gain',
        '--import-tags-from',
        metaFlacInputTextPath,
        '--import-picture-from',
        jacketAssetPath,
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.flac',
        ),
      ],
      {},
      false,
    );
    await subProcessUtils.spawnAsync(
      path.resolve(appConfig.file.cliPath.metaflac),
      [
        '--remove-tag',
        'REPLAYGAIN_ALBUM_GAIN',
        '--remove-tag',
        'REPLAYGAIN_ALBUM_PEAK',
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.flac',
        ),
      ],
      {},
      false,
    );
  })();

  //* ===== Encode AAC =====
  await (async () => {
    logger.debug(chalk.gray('[Live Audio] ') + 'Encoding mastered audio to AAC ...');
    await subProcessUtils.spawnAsync(
      path.resolve(appConfig.file.cliPath.qaac),
      [
        '-V', // --tvbr
        String(127),
        '-q', // --quality
        String(2),
        '-r', // --rate
        'keep',
        '--no-delay',
        '--gapless-mode',
        String(0),
        '--threading',
        '--artist',
        TypesAssetCsvStructure.musicScorePartTrackStringSortedArray
          .map((key) => selectedSingChara[key])
          .filter((val): val is number => val !== null)
          .map(
            (entry) =>
              `${
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === entry,
                ).text
              } (CV: ${
                db.masterDb.text_data.find(
                  (texEntry: any) => texEntry.id === 7 && texEntry.category === 7 && texEntry.index === entry,
                ).text
              })`,
          )
          .join(', '),
        '--lyrics',
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.assets,
          configUser.getConfig().file.assetUnityInternalPathDir,
          `live/musicscores/m${liveId}/m${liveId}_lyrics.lrc`,
        ),
        '--copy-artwork',
        '-o',
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.m4a',
        ),
        path.join(
          argvUtils.getArgv().outputDir,
          configUser.getConfig().file.outputSubPath.renderedAudio,
          'mix_norm_' + baseFilename + '.flac',
        ),
      ],
      {},
      false,
    );
  })();

  //* ===== Encode Opus =====
  // await (async () => {
  //   logger.debug(chalk.gray('[Live Audio] ') + 'Encoding mastered audio to Opus ...');
  //   await subProcessUtils.spawnAsync(
  //     appConfig.file.cliPath.opusenc,
  //     [
  //       '--bitrate',
  //       String(160),
  //       '--vbr',
  //       '--music',
  //       '--comp',
  //       String(10),
  //       '--framesize',
  //       String(20),
  //       path.join(
  //         argvUtils.getArgv().outputDir,
  //         configUser.getConfig().file.outputSubPath.renderedAudio,
  //         'mix_norm_' + baseFilename + '.flac',
  //       ),
  //       path.join(
  //         argvUtils.getArgv().outputDir,
  //         configUser.getConfig().file.outputSubPath.renderedAudio,
  //         'mix_norm_' + baseFilename + '.opus',
  //       ),
  //     ],
  //     {},
  //     false,
  //   );
  //   // await subProcessUtils.spawnAsync(appConfig.file.cliPath.ffmpeg, [
  //   //   '--loglevel',
  //   //   'warning',
  //   //   '-i',
  //   //   path.join(
  //   //     argvUtils.getArgv().outputDir,
  //   //     configUser.getConfig().file.outputSubPath.renderedAudio,
  //   //     'mix_norm_' + baseFilename + '.tmp.opus',
  //   //   ),

  //   // ], {}, false);
  // })();

  await fs.rm(
    path.join(argvUtils.getArgv().outputDir, configUser.getConfig().file.outputSubPath.renderedAudio, 'tmp'),
    { recursive: true, force: true },
  );
  logger.info(chalk.gray('[Live Audio] ') + 'Everything is OK');
}

export default {
  generateMain,
};
