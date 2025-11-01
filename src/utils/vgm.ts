import fs from 'node:fs/promises';
import path from 'node:path';
// import bun from 'bun';
import appConfig from './config.js';
// import configUser from './configUser.js';
import subProcessUtils from './subProcess.js';

async function generateCmdSingleFileAudio(filePath: string) {
  const retCmdLineObj: { command: string; args: string[] }[] = [];
  const vgmInfoRootJson = await (async () => {
    try {
      const ret = (
        await subProcessUtils.spawnAsync(
          path.resolve(appConfig.file.cliPath.vgmstream),
          ['-m', '-I', '-S', '0', path.resolve(filePath)],
          {},
          false,
        )
      ).stdout
        .trim()
        .replaceAll('\r\n', '\n');
      if (ret.includes('decryption key not found') || ret.includes('bank has no subsongs')) return [];
      else {
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
    await fs.mkdir(
      path.join(path.dirname(path.resolve(filePath)), path.basename(path.resolve(filePath)).replaceAll('.', '_')),
      { recursive: true },
    );
  }
  if (vgmInfoRootJson.length > 0) {
    await fs.writeFile(filePath + '.json', JSON.stringify(vgmInfoRootJson, null, 2), 'utf-8');
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
      retCmdLineObj.push({
        command: path.resolve(appConfig.file.cliPath.vgmstream),
        args: ['-o', outputPathStr, '-i', '-F', '-s', String(i + 1), '-L', path.resolve(filePath)],
      });
      retCmdLineObj.push({
        command: path.resolve(appConfig.file.cliPath.flac),
        args: [
          '--delete-input-file',
          '-f', // --force
          '-V', // --verify
          '-j', // --threads
          String(8),
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
          outputPathStr.replace(/\.wav$/, '.flac'),
          outputPathStr,
        ],
      });
    }
  }
  return retCmdLineObj;
}

export default {
  generateCmdSingleFileAudio,
};
