import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import util from 'node:util';
import ffmpeg from 'fluent-ffmpeg';
import { DateTime } from 'luxon';
import prompts from 'prompts';
import logger from './logger.js';
import * as TypesAssetEntry from '../types/AssetEntry.js';
import * as TypesAssetCsvStructure from '../types/AssetCsvStructure.js';
import fileUtils from './fileUtils.js';
import argvUtils from './argv.js';
import appConfig from './config.js';
import mathUtils from './mathUtils.js';
import Ffmpeg from 'fluent-ffmpeg';
const execPromise = util.promisify(child_process.exec);

async function test(
  db: {
    assetDb: (TypesAssetEntry.AssetDbConvertedEntry & {
      isFileExists: boolean;
    })[];
    masterDb: {
      [key: string]: any;
    };
  },
  liveId: number,
) {
  if (!db.masterDb.live_data.find((entry: { [key: string]: any }) => entry.music_id === liveId)) {
    throw new Error(`live '${liveId}' not found`);
  }
  // logger.trace(
  //   'liveId =',
  //   liveId,
  //   `'${
  //     db.masterDb.text_data
  //       .filter((entry: { [key: string]: any }) => entry.id === 16 && entry.category === 16)
  //       .find((entry: { [key: string]: any }) => entry.index === liveId).text
  //   }'`,
  // );
  const musicScoreData: {
    cyalume: Array<TypesAssetCsvStructure.MusicscoreCyalumeOrig>;
    lyrics: Array<TypesAssetCsvStructure.MusicscoreLyricsParsed>;
    part: TypesAssetCsvStructure.MusicscorePartJson;
  } = await (async () => {
    if (
      !(
        (await fileUtils.exists(
          path.join(
            argvUtils.getArgv().outputDir,
            appConfig.file.assetUnityInternalPathDir,
            `live/musicscores/m${liveId}/m${liveId}_cyalume.json`,
          ),
        )) &&
        (await fileUtils.exists(
          path.join(
            argvUtils.getArgv().outputDir,
            appConfig.file.assetUnityInternalPathDir,
            `live/musicscores/m${liveId}/m${liveId}_lyrics.json`,
          ),
        )) &&
        (await fileUtils.exists(
          path.join(
            argvUtils.getArgv().outputDir,
            appConfig.file.assetUnityInternalPathDir,
            `live/musicscores/m${liveId}/m${liveId}_part.json`,
          ),
        ))
      )
    ) {
      // アセット欠落してるときの処理
    }
    return {
      cyalume: JSON.parse(
        await fs.promises.readFile(
          path.join(
            argvUtils.getArgv().outputDir,
            appConfig.file.assetUnityInternalPathDir,
            `live/musicscores/m${liveId}/m${liveId}_cyalume.json`,
          ),
          { encoding: 'utf-8' },
        ),
      ),
      lyrics: JSON.parse(
        await fs.promises.readFile(
          path.join(
            argvUtils.getArgv().outputDir,
            appConfig.file.assetUnityInternalPathDir,
            `live/musicscores/m${liveId}/m${liveId}_lyrics.json`,
          ),
          { encoding: 'utf-8' },
        ),
      ),
      part: JSON.parse(
        await fs.promises.readFile(
          path.join(
            argvUtils.getArgv().outputDir,
            appConfig.file.assetUnityInternalPathDir,
            `live/musicscores/m${liveId}/m${liveId}_part.json`,
          ),
          { encoding: 'utf-8' },
        ),
      ),
    };
  })();

  const liveCanUseCharaArray: Array<number> = (() => {
    if (db.masterDb.live_data.find((entry: any) => entry.music_id === liveId).song_chara_type === 1) {
      // キャラ全員歌唱可能フラグ立ってる
      return [
        ...db.masterDb.chara_data
          .filter((entry: any) => entry.start_date < DateTime.now().toSeconds())
          .map((entry: any) => entry.id),
        ...db.masterDb.live_permission_data
          .filter((entry: any) => entry.music_id === liveId)
          .map((entry: any) => entry.chara_id),
      ];
    } else if (db.masterDb.live_data.find((entry: any) => entry.music_id === liveId).song_chara_type === 2) {
      // キャラ全員歌唱可能フラグ立ってない
      return db.masterDb.live_permission_data
        .filter((entry: any) => entry.music_id === liveId)
        .map((entry: any) => entry.chara_id);
    }
  })();
  const userSelectedSingChara: Record<string, number | null> = await (async () => {
    let retObj: Record<string, number | null> = {
      left3: null,
      left2: null,
      left: null,
      center: null,
      right: null,
      right2: null,
      right3: null,
    };
    console.log(
      `Available singing position: ${Object.entries(musicScoreData.part.availableTrack)
        .filter((value) => value[1] === true)
        .map((value) => `'${value[0]}'`)
        .join(', ')}`,
    );
    for (let i = 0; i < Object.keys(musicScoreData.part.availableTrack).length; i++) {
      if (Object.values(musicScoreData.part.availableTrack)[i] === true) {
        retObj[Object.keys(musicScoreData.part.availableTrack)[i]] = (
          await prompts({
            type: 'select',
            name: 'value',
            message: `Select singing chara for '${Object.keys(musicScoreData.part.availableTrack)[i]}' position`,
            choices: liveCanUseCharaArray.map((entry) => ({
              title:
                entry +
                ' - ' +
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
      }
    }
    return retObj;
  })();
  await processAudio(
    db,
    liveId,
    musicScoreData,
    userSelectedSingChara as {
      left3: number | null;
      left2: number | null;
      left: number | null;
      center: number | null;
      right: number | null;
      right2: number | null;
      right3: number | null;
    },
  );
}

async function processAudio(
  db: {
    assetDb: (TypesAssetEntry.AssetDbConvertedEntry & {
      isFileExists: boolean;
    })[];
    masterDb: {
      [key: string]: any;
    };
  },
  liveId: number,
  musicScoreData: {
    cyalume: Array<TypesAssetCsvStructure.MusicscoreCyalumeOrig>;
    lyrics: Array<TypesAssetCsvStructure.MusicscoreLyricsParsed>;
    part: TypesAssetCsvStructure.MusicscorePartJson;
  },
  userSelectedSingChara: {
    left3: number | null;
    left2: number | null;
    left: number | null;
    center: number | null;
    right: number | null;
    right2: number | null;
    right3: number | null;
  },
) {
  await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp'), { recursive: true, force: true });
  const positionList = Object.entries(musicScoreData.part.availableTrack)
    .filter((entry) => entry[1] === true)
    .map((entry) => entry[0]) as Array<TypesAssetCsvStructure.MusicscorePartTrackString>;
  const okeMetadataJson = JSON.parse(
    await fs.promises.readFile(
      path.join(
        argvUtils.getArgv().outputDir,
        appConfig.file.assetUnityInternalPathDir,
        `sound/l/${liveId}/snd_bgm_live_${liveId}_oke_02.awb.json`,
      ),
      { encoding: 'utf-8' },
    ),
  );
  const liveSongDurationMs = Math.ceil((okeMetadataJson[0].numberOfSamples / okeMetadataJson[0].sampleRate) * 1000);
  const timeStartEndArray: Array<{
    startMs: number;
    endMs: number;
  }> = (() => {
    const tmpArr = new Array();
    for (let i = 0; i < musicScoreData.part.part.length; i++) {
      tmpArr.push({
        startMs: musicScoreData.part.part[i].timeMs,
        endMs: musicScoreData.part.part[i + 1] ? musicScoreData.part.part[i + 1].timeMs : -1,
      });
    }
    return tmpArr;
  })();
  const subSongCount = mathUtils.arrayMax(
    musicScoreData.part.part.map((entry) => mathUtils.arrayMax(Object.values(entry.tracks))),
  );
  await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp'), { recursive: true, force: true });

  //* ===== Extract original audio segments (split) =====
  logger.info('Live audio - Extracting audio segments ...');
  await fs.promises.mkdir(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', 'split_orig'), {
    recursive: true,
  });
  for (const positionKey of positionList) {
    for (const timeStartEndEntry of timeStartEndArray) {
      for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
        await new Promise((resolve, reject) => {
          ffmpeg(
            path.join(
              argvUtils.getArgv().outputDir,
              appConfig.file.assetUnityInternalPathDir,
              `sound/l/${liveId}`,
              subSongCount > 1
                ? `snd_bgm_live_${liveId}_chara_${userSelectedSingChara[positionKey]}_01_awb/${String(subSongIndex).padStart(8, '0')}_snd_bgm_live_${liveId}_chara_${userSelectedSingChara[positionKey]}_01.flac`
                : `snd_bgm_live_${liveId}_chara_${userSelectedSingChara[positionKey]}_01.awb.flac`,
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
                'mixAudio',
                'tmp',
                'split_orig',
                `l${liveId}_${positionKey}_c${userSelectedSingChara[positionKey]}_s${subSongIndex}_${timeStartEndEntry.startMs}-${timeStartEndEntry.endMs}.wav`,
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
  logger.info('Live audio - Processing audio segments ...');
  await fs.promises.mkdir(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', 'split_processed'), {
    recursive: true,
  });
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
                'mixAudio',
                'tmp',
                'split_orig',
                `l${liveId}_${positionKey}_c${userSelectedSingChara[positionKey]}_s${subSongIndex}_${timeStartEndArray[parseInt(partIndex)].startMs}-${timeStartEndArray[parseInt(partIndex)].endMs}.wav`,
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
                  'mixAudio',
                  'tmp',
                  'split_processed',
                  `l${liveId}_${positionKey}_c${userSelectedSingChara[positionKey]}_s${subSongIndex}_${timeStartEndArray[parseInt(partIndex)].startMs}-${timeStartEndArray[parseInt(partIndex)].endMs}.wav`,
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
  await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', 'split_orig'), {
    recursive: true,
    force: true,
  });

  //* ===== Concat all processed segments =====
  logger.info('Live audio - Compositing processed segments ...');
  for (const positionKey of positionList) {
    await fs.promises.mkdir(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', 'concat_processed'), {
      recursive: true,
    });
    for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
      await (async () => {
        const inputFiles = timeStartEndArray.map((entry) => {
          return path.join(
            argvUtils.getArgv().outputDir,
            'mixAudio',
            'tmp',
            'split_processed',
            `l${liveId}_${positionKey}_c${userSelectedSingChara[positionKey]}_s${subSongIndex}_${entry.startMs}-${entry.endMs}.wav`,
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
                'mixAudio',
                'tmp',
                'concat_processed',
                `l${liveId}_${positionKey}_c${userSelectedSingChara[positionKey]}_s${subSongIndex}.wav`,
              ),
            )
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      })();
    }
  }
  await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', 'split_processed'), {
    recursive: true,
    force: true,
  });

  //* ===== Mix all audio tracks =====
  logger.info('Live audio - Mixing audio tracks ...');
  await (async () => {
    const inputFiles: string[] = [];
    inputFiles.push(
      path.join(
        argvUtils.getArgv().outputDir,
        appConfig.file.assetUnityInternalPathDir,
        `sound/l/${liveId}/snd_bgm_live_${liveId}_oke_02.awb.flac`,
      ),
    );
    for (const positionKey of positionList) {
      for (let subSongIndex = 0; subSongIndex < subSongCount; subSongIndex++) {
        inputFiles.push(
          path.join(
            argvUtils.getArgv().outputDir,
            'mixAudio',
            'tmp',
            'concat_processed',
            `l${liveId}_${positionKey}_c${userSelectedSingChara[positionKey]}_s${subSongIndex}.wav`,
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
          inputFiles.map((_, index) => `[${index}:a]volume=${volumeBoost}[a${index}]`).join(';') +
            ';' +
            inputFiles.map((_, index) => `[a${index}]`).join('') +
            `amix=inputs=${inputFiles.length}:duration=longest:dropout_transition=2147483647[aout]`,
        )
        .audioCodec('pcm_f32le')
        .outputOptions(['-map [aout]'])
        .output(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', `l${liveId}_mix_raw.wav`))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
  })();
  await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', 'concat_processed'), {
    recursive: true,
    force: true,
  });

  //* ===== Mastering mixed audio =====
  logger.info('Live audio - Mastering audio track ...');
  await (async () => {
    const baseFilename = `${liveId}_${
      db.masterDb.text_data.find(
        (texEntry: any) => texEntry.id === 16 && texEntry.category === 16 && texEntry.index === liveId,
      ).text
    }_${Object.values(userSelectedSingChara)
      .filter((entry) => entry !== null)
      .map(
        (entry) =>
          db.masterDb.text_data.find(
            (texEntry: any) => texEntry.id === 6 && texEntry.category === 6 && texEntry.index === entry,
          ).text,
      )
      .join('_')}`;
    const premasterLoudnessStats = await (async () => {
      let outputRow = '';
      await new Promise((resolve, reject) => {
        ffmpeg(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', `l${liveId}_mix_raw.wav`))
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
    await fs.promises.copyFile(
      path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', `l${liveId}_mix_raw.wav`),
      path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'mix_orig_' + baseFilename + '.wav'),
    );
    await execPromise(
      `"${path.resolve(appConfig.file.soxCliPath)}" --buffer 65536 --guard --multi-threaded --replay-gain off --show-progress -V3 "${path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp', `l${liveId}_mix_raw.wav`)}" --bits 24 --channels 2 --encoding signed-integer "${path.join(
        argvUtils.getArgv().outputDir,
        'mixAudio',
        'mix_norm_' + baseFilename + '.wav',
      )}" vol ${appConfig.audio.targetLoudness - parseFloat(premasterLoudnessStats.input_i)}dB gain -l gain -0.05`,
    );
    await execPromise(
      `"${path.resolve(appConfig.file.flacCliPath)}" --verify --max-lpc-order=12 --blocksize=4608 --mid-side --rice-partition-order=8 --apodization=subdivide_tukey(5) --delete-input-file -f -o "${path.join(
        argvUtils.getArgv().outputDir,
        'mixAudio',
        'mix_norm_' + baseFilename + '.flac',
      )}" "${path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'mix_norm_' + baseFilename + '.wav')}"`,
    );
  })();
  await fs.promises.rm(path.join(argvUtils.getArgv().outputDir, 'mixAudio', 'tmp'), { recursive: true, force: true });
  logger.info('Live audio - Everything is OK');
}

export default {
  test,
};
