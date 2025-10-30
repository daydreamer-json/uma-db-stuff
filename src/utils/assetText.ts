import path from 'node:path';
import bun from 'bun';
import { Duration } from 'luxon';
import Papa from 'papaparse';
import * as TypesAssetCsvStructure from '../types/AssetCsvStructure';

async function parseCsvFile(filePath: string) {
  const inputContext = (await bun.file(path.resolve(filePath)).text()).replaceAll('\r\n', '\n').trim();
  const parsedContext = Papa.parse(
    inputContext.replace(
      'time,lleft,left,center,right,rright,lleft_vol,left_vol,center_vol,right_vol,right_vol,lleft_pan,left_pan,center_pan,right_pan,rright_pan',
      'time,lleft,left,center,right,rright,lleft_vol,left_vol,center_vol,right_vol,rright_vol,lleft_pan,left_pan,center_pan,right_pan,rright_pan',
    ),
    {
      header: true,
      skipEmptyLines: true,
    },
  ).data as Array<object>;
  if (path.parse(filePath).name.match(/_part/)) {
    const response = parseJsonMusicscorePart(parsedContext as Array<TypesAssetCsvStructure.MusicscorePartOrig>);
    await bun.write(
      path.join(path.dirname(filePath), path.parse(filePath).name + '.json'),
      JSON.stringify(response, null, 2),
    );
    return response;
  } else if (path.parse(filePath).name.match(/_lyrics/)) {
    const response = parseJsonMusicscoreLyrics(parsedContext as Array<TypesAssetCsvStructure.MusicscoreLyricsOrig>);
    await bun.write(
      path.join(path.dirname(filePath), path.parse(filePath).name + '.json'),
      JSON.stringify(response, null, 2),
    );
    await bun.write(path.join(path.dirname(filePath), path.parse(filePath).name + '.lrc'), response.lrcEncoded);
    return response;
  }
  await bun.write(
    path.join(path.dirname(filePath), path.parse(filePath).name + '.json'),
    JSON.stringify(parsedContext, null, 2),
  );
  return parsedContext;
}

function parseJsonMusicscorePart(inputObj: Array<TypesAssetCsvStructure.MusicscorePartOrig>): {
  availableTrack: {
    left3: boolean;
    left2: boolean;
    left: boolean;
    center: boolean;
    right: boolean;
    right2: boolean;
    right3: boolean;
  };
  part: Array<TypesAssetCsvStructure.MusicscorePartParsed>;
} {
  const tmp = inputObj.map((entry) => ({
    timeMs: parseInt(entry.time),
    tracksEnable: {
      left3: parseInt(entry.left3 ?? '0') >= 1,
      left2:
        ('left2' in entry ? parseInt(entry.left2 ?? '0') : 'lleft' in entry ? parseInt(entry.lleft ?? '0') : 0) >= 1,
      left: parseInt(entry.left ?? '0') >= 1,
      center: parseInt(entry.center) >= 1,
      right: parseInt(entry.right ?? '0') >= 1,
      right2:
        ('right2' in entry ? parseInt(entry.right2 ?? '0') : 'rright' in entry ? parseInt(entry.rright ?? '0') : 0) >=
        1,
      right3: parseInt(entry.right3 ?? '0') >= 1,
    },
    tracks: {
      left3: parseInt(entry.left3 ?? '0'),
      left2: 'left2' in entry ? parseInt(entry.left2 ?? '0') : 'lleft' in entry ? parseInt(entry.lleft ?? '0') : 0,
      left: parseInt(entry.left ?? '0'),
      center: parseInt(entry.center ?? '0'),
      right: parseInt(entry.right ?? '0'),
      right2: 'right2' in entry ? parseInt(entry.right2 ?? '0') : 'rright' in entry ? parseInt(entry.rright ?? '0') : 0,
      right3: parseInt(entry.right3 ?? '0'),
    },
    volume: {
      left3: 'left3_vol' in entry ? parseFloat(entry.left3_vol ?? '0') : null,
      left2:
        'left2_vol' in entry
          ? parseFloat(entry.left2_vol ?? '0')
          : 'lleft_vol' in entry
            ? parseFloat(entry.lleft_vol ?? '0')
            : null,
      left: 'left_vol' in entry ? parseFloat(entry.left_vol ?? '0') : null,
      center: 'center_vol' in entry ? parseFloat(entry.center_vol ?? '0') : null,
      right: 'right_vol' in entry ? parseFloat(entry.right_vol ?? '0') : null,
      right2:
        'right2_vol' in entry
          ? parseFloat(entry.right2_vol ?? '0')
          : 'rright_vol' in entry
            ? parseFloat(entry.rright_vol ?? '0')
            : null,
      right3: 'right3_vol' in entry ? parseFloat(entry.right3_vol ?? '0') : null,
    },
    pan: {
      left3: 'left3_pan' in entry ? parseFloat(entry.left3_pan ?? '0') : null,
      left2:
        'left2_pan' in entry
          ? parseFloat(entry.left2_pan ?? '0')
          : 'lleft_pan' in entry
            ? parseFloat(entry.lleft_pan ?? '0')
            : null,
      left: 'left_pan' in entry ? parseFloat(entry.left_pan ?? '0') : null,
      center: 'center_pan' in entry ? parseFloat(entry.center_pan ?? '0') : null,
      right: 'right_pan' in entry ? parseFloat(entry.right_pan ?? '0') : null,
      right2:
        'right2_pan' in entry
          ? parseFloat(entry.right2_pan ?? '0')
          : 'rright_pan' in entry
            ? parseFloat(entry.rright_pan ?? '0')
            : null,
      right3: 'right3_pan' in entry ? parseFloat(entry.right3_pan ?? '0') : null,
    },
  }));
  return {
    availableTrack: {
      left3: tmp.find((obj) => obj.tracksEnable.left3 === true) ? true : false,
      left2: tmp.find((obj) => obj.tracksEnable.left2 === true) ? true : false,
      left: tmp.find((obj) => obj.tracksEnable.left === true) ? true : false,
      center: tmp.find((obj) => obj.tracksEnable.center === true) ? true : false,
      right: tmp.find((obj) => obj.tracksEnable.right === true) ? true : false,
      right2: tmp.find((obj) => obj.tracksEnable.right2 === true) ? true : false,
      right3: tmp.find((obj) => obj.tracksEnable.right3 === true) ? true : false,
    },
    part: tmp,
  };
}

function parseJsonMusicscoreLyrics(inputObj: Array<TypesAssetCsvStructure.MusicscoreLyricsOrig>): {
  parsed: Array<TypesAssetCsvStructure.MusicscoreLyricsParsed>;
  lrcEncoded: string;
} {
  return {
    parsed: inputObj.map((entry) => {
      return {
        timeMs: parseInt(entry.time),
        lyrics: entry.lyrics.replaceAll('[COMMA]', ','),
      };
    }),
    lrcEncoded: inputObj
      .map((entry) => {
        return `[${`${Duration.fromMillis(parseInt(entry.time)).toFormat('mm:ss')}.${String(Math.round(parseInt(entry.time) / 10) % 100).padStart(2, '0')}`}]${entry.lyrics.replaceAll('[COMMA]', ',')}`;
      })
      .join('\n'),
  };
}

export default {
  parseCsvFile,
};
