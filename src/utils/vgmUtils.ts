import fs from 'node:fs';
import path from 'node:path';
import child_process from 'node:child_process';
import util from 'node:util';
import appConfig from './config.js';
import fileUtils from './fileUtils.js';
import argvUtils from './argv.js';
import logger from './logger.js';
import * as TypesAssetEntry from '../types/AssetEntry.js';
const execPromise = util.promisify(child_process.exec);

async function generateCmdSingleFileAudio(filePath: string) {
  const retCmdLineObj: Array<string> = new Array();
  const vgmInfoRootJson = await (async () => {
    try {
      const ret = (
        await execPromise(`"${path.resolve(appConfig.file.vgmstreamCliPath)}" -m -I -S 0 "${path.resolve(filePath)}"`)
      ).stdout
        .trim()
        .replaceAll('\r\n', '\n');
      if (ret.includes('HCA: decryption key not found') || ret.includes('ACB: bank has no subsongs')) {
        return [];
      } else {
        const tmpArr = new Array();
        for (const tmp of ret.split('\n').map((str) => JSON.parse(str))) {
          if (tmp.streamInfo.name !== null && tmp.streamInfo.name.match(/ \[pre\]$/)) {
          } else {
            tmpArr.push(tmp);
          }
        }
        return tmpArr;
      }
    } catch (error) {
      return [];
    }
  })();
  if (vgmInfoRootJson.length > 1) {
    await fs.promises.mkdir(
      path.join(path.dirname(path.resolve(filePath)), path.basename(path.resolve(filePath)).replaceAll('.', '_')),
      {
        recursive: true,
      },
    );
  }
  if (vgmInfoRootJson.length > 0) {
    await fs.promises.writeFile(filePath + '.json', JSON.stringify(vgmInfoRootJson, null, 2), { encoding: 'utf-8' });
    for (let i = 0; i < vgmInfoRootJson.length; i++) {
      const outputPathStr = (() => {
        if (vgmInfoRootJson.length > 1) {
          return path.resolve(
            path.join(
              path.dirname(path.resolve(filePath)),
              path.basename(path.resolve(filePath)).replaceAll('.', '_'),
              i.toString().padStart(8, '0') +
                (vgmInfoRootJson[i].streamInfo.name !== null ? `_${vgmInfoRootJson[i].streamInfo.name}` : '') +
                '.wav',
            ),
          );
        } else {
          return path.resolve(
            path.join(path.dirname(path.resolve(filePath)), path.basename(path.resolve(filePath)) + '.wav'),
          );
        }
      })();
      retCmdLineObj.push(
        `"${path.resolve(appConfig.file.vgmstreamCliPath)}" -o "${outputPathStr}" -i -F -s ${i + 1} -L "${path.resolve(filePath)}"`,
      );
      retCmdLineObj.push(
        `"${path.resolve(appConfig.file.flacCliPath)}" --verify --max-lpc-order=12 --blocksize=4608 --mid-side --rice-partition-order=8 --apodization=subdivide_tukey(5) --delete-input-file -f -o "${outputPathStr.replace(/\.wav$/, '.flac')}" "${outputPathStr}"`,
      );
    }
  }
  return retCmdLineObj;
}

export default {
  generateCmdSingleFileAudio,
};
