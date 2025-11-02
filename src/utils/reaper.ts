import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zstd from '@mongodb-js/zstd';
import chalk from 'chalk';
import ora from 'ora';
import { rimraf } from 'rimraf';
import appConfig from './config.js';
import fileUtils from './file.js';
import logger from './logger.js';
import stringUtils from './string.js';
// import spinnerConfig from './spinnerConfig.js';
import subProcessUtils from './subProcess.js';

async function reaperCleaning() {
  await (async () => {
    //* Delete unnecessary folders and files
    const targetDirArray: string[] = [
      'FXChains',
      'OSC',
      'presets',
      'ProjectTemplates',
      'Scripts',
      'TrackTemplates',
      'UserPlugins',
    ].map((el) => path.join(path.dirname(path.resolve(appConfig.file.cliPath.reaper)), el));
    const targetFileArray: string[] = [
      'reaper-clap-win64.ini',
      'reaper-convertfx.ini',
      'reaper-convertmetadata.ini',
      'reaper-fxtags.ini',
      'reaper-jsfx.ini',
      'reaper-midihw.ini',
      'reaper-mouse.ini',
      'reaper-recentfx.ini',
      'reaper-vstplugins64.ini',
      'REAPER-wndpos.ini',
    ].map((el) => path.join(path.dirname(path.resolve(appConfig.file.cliPath.reaper)), el));
    for (const targetDir of targetDirArray) {
      await rimraf(targetDir);
    }
    for (const targetFile of targetFileArray) {
      await rimraf(targetFile);
    }
  })();
  //* Apply config to default value
  await fileUtils.copyFileWithStream(
    path.join(path.dirname(path.resolve(appConfig.file.cliPath.reaper)), 'reaper_default.ini'),
    path.join(path.dirname(path.resolve(appConfig.file.cliPath.reaper)), 'reaper.ini'),
  );
}

async function tr5StealthLimiter_preparePre() {
  // this vst throws an error when it cant find some files
  // but itll shut the fuck up it if we just make a dummy 0-byte file lol
  const uiSpinner = ora({
    text: 'Preparing VST plugin files ...',
    color: 'cyan',
    spinner: 'dots12',
  }).start();
  const targetFiles: string[] = [
    'C:/Program Files/IK Multimedia/T-RackS 5/T-RackS 5.exe',
    'C:/Program Files/IK Multimedia/T-RackS 5/T-RackS 5.pak',
    'C:/Program Files/IK Multimedia/T-RackS 5/T-RackS 5.app.pak',
  ].map((el) => path.resolve(el));
  const isTargetFilesExists: boolean[] = [];
  const movedFiles: string[] = [];
  for (const targetFile of targetFiles) {
    if (await fileUtils.checkFileExists(targetFile)) {
      isTargetFilesExists.push(true);
      const moveFilePath: string = path.join(path.dirname(targetFile), 'backup_' + stringUtils.getRandomHexHashStr(8));
      movedFiles.push(moveFilePath);
      // logger.trace(`Renaming exist: '${path.basename(targetFile)}' -> '${path.basename(moveFilePath)}'`);
      await subProcessUtils.spawnAsync('cmd.exe', ['/c', 'move', `${targetFile}`, `${moveFilePath}`], {}, false);
    } else {
      isTargetFilesExists.push(false);
      movedFiles.push('');
    }
    await fs.writeFile(targetFile, '', 'utf-8'); // write dummy empty file
  }
  uiSpinner.stop();
  return {
    targetFiles,
    isTargetFilesExists,
    movedFiles,
  };
}

async function tr5StealthLimiter_preparePost(preRetObj: {
  targetFiles: string[];
  isTargetFilesExists: boolean[];
  movedFiles: string[];
}) {
  // logger.debug('Cleaning VST plugin files ...');
  const uiSpinner = ora({
    text: 'Cleaning VST plugin files ...',
    color: 'cyan',
    spinner: 'dots12',
  }).start();
  for (let i = 0; i < preRetObj.targetFiles.length; i++) {
    const targetFile: string = preRetObj.targetFiles[i]!;
    const isTargetFileExists: boolean = preRetObj.isTargetFilesExists[i]!;
    const movedFile: string = preRetObj.movedFiles[i]!;
    await fs.rm(targetFile);
    if (isTargetFileExists) {
      // logger.trace(`Restoring: '${path.basename(movedFile)}' -> '${path.basename(targetFile)}'`);
      await subProcessUtils.spawnAsync('cmd.exe', ['/c', 'move', `${movedFile}`, `${targetFile}`], {}, false);
    }
  }
  uiSpinner.stop();
}

async function tr5StealthLimiter_buildFxChain(
  inputPath: string,
  outputPath: string,
  gain: {
    input: number;
    output: number;
  },
) {
  if (gain.input < 0 || gain.output > 0) {
    throw new Error('This VST plugin does not support specified gain: ' + JSON.stringify(gain));
  }
  //* Build Batch convert config file (including REAPER FX Chain)
  const outputText =
    `${path.resolve(inputPath)}` +
    '\r\n<CONFIG\r\n  RSMODE 9\r\n  DITHER 0\r\n  OUTPATH ' +
    `${path.dirname(path.resolve(outputPath))}` +
    '\r\n  OUTPATTERN ' +
    `${path.basename(path.resolve(outputPath))}` +
    '\r\n  <FXCHAIN\r\n    SHOW 0\r\n    LASTSEL 0\r\n    DOCKED 0\r\n    BYPASS 0 0 0\r\n    <VST "VST3: TR5 Stealth Limiter (IK Multimedia)" "' +
    path.resolve(appConfig.file.vstPath.tr5) +
    '" 0 "" 1456132600{5653545435333274723520737465616C} ""' +
    (await zstd.decompress(
      Buffer.from(
        'KLUv/WAAAH0DACLFEhlgrw6ENPidkHlDyLb6oO1ClRVxWi3ZsIESzMzMrN12/LwWoKulVSPVxd9qLg0kxAjRE//L/1Qfwr+N96b8jO8fw1RIxHWUhDpmLQ4AxYnnWm0RCyzuNWPCfRLoGgNMXHg4YczEABAG4l9gCA==',
        'base64',
      ),
    )) +
    (await (async () => {
      return Buffer.concat([
        await zstd.decompress(
          Buffer.from(
            'KLUv/WAbABUFAFIKIxgweQMVOr1gTHoRv/Wku/2yKB9sBQ3yBlg3X5v0qlQ9t/W6VEGOOf+T9bcJMaIVvHwYwcSnIB4BLgomjEVhiPBIFOx9zc2lBjn2vXtnG33Ky835F4bnGjenfOynt7d7c6q7RrV0axRVpe96c4RBGB7oMgTFdTeLmwT5t/Vfozhu3pzsqF6/NFnIyQIgBgBUFGwpUAlnyGkSAKSCLRMQAg==',
            'base64',
          ),
        ),
        Buffer.from(String(gain.input).padEnd(17, '0'), 'utf-8'),
        Buffer.from('IiBJbnB1dEdhaW5SPSI=', 'base64'),
        Buffer.from(String(gain.input).padEnd(17, '0'), 'utf-8'),
        Buffer.from('Ig0KICAgICAgICAgICAgT3V0cHV0TGV2ZWxMPSI=', 'base64'),
        Buffer.from(String(gain.output).padEnd(18, '0'), 'utf-8'),
        Buffer.from('IiBPdXRwdXRMZXZlbFI9Ig==', 'base64'),
        Buffer.from(String(gain.output).padEnd(18, '0'), 'utf-8'),
        await zstd.decompress(
          Buffer.from(
            'KLUv/WATBSULAAZSPBQQ/UBt2t8Alh//OO97AqhUVXT1ZTUANgA1AH7x1Wfp0PC0aP8Xh7MUWnzlznBcy+ptf338eAxvKzzTt2q3s2d4xVc2TYczrHI7Ds+nMRA+TrQ6jHOsEKMebAQ5hxJB0tEuDeSo66T46r7Ver8MnI7NhLISXyag4StfxX+e1RfD52/bOWYExo/V1YRzrmF86izl4Ssw/voH8XwsPbQsyuQsyoKAeF7/OGfp0C++yjycfu9anU3DT63DfCgFIAQBoOJq9nFVh21Sw84PmGn4vn+0TM7iSNEjNRD+uvDvfPMs0cQ8DaMoyOKrF2dhlIZxtQwuIFDEMHK6DV8CoCnDAAAHOQLKxAOKHID5TehcTprugsXXIUG9SFBZgSllXx1hcckccsvcGadXjEN0cuAC42cHpCt2cxyGY7h9CgaaAAUARH0AbMH6jbmAx3LFlnIAR7Y840DDwLZsRl+QQ6uBNwAR',
            'base64',
          ),
        ),
      ])
        .toString('base64')
        .match(/.{1,128}/gs)
        ?.join('\r\n      ');
    })()) +
    (await zstd.decompress(
      Buffer.from(
        'KLUv/SCjvQMAEgYWGUC1DhMHQ6gqXdlMaG/bWnk+iEj7s6i4eEUQUJKE+rdO47CM4aixdZEZmypluZ9fXwddCEK1zHJcnrCGnPVT0h6qJI62lNJ7kXFyEKs74V+olf+n/kcIBAsIECAkH1ElptS8YC6GIAxRlcrZ5lDlnSnOwRA=',
        'base64',
      ),
    ));
  return outputText;
}

async function tr5StealthLimiter_runPlugin(
  inputPath: string,
  outputPath: string,
  tmpConfigPath: string,
  gain: {
    input: number;
    output: number;
  },
) {
  const preparePreResult = await tr5StealthLimiter_preparePre();
  const inputTmpPath = path.resolve(
    path.parse(inputPath).root +
      [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32) +
      path.extname(inputPath),
  );
  const outputTmpPath = path.resolve(
    path.parse(outputPath).root +
      [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32) +
      path.extname(outputPath),
  );
  const tmpConfigTmpPath = path.resolve(
    path.parse(tmpConfigPath).root +
      [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 32) +
      path.extname(tmpConfigPath),
  );
  await subProcessUtils.spawnAsync('cmd.exe', ['/c', 'move', '/y', `${inputPath}`, `${inputTmpPath}`], {}, false);
  await fs.writeFile(
    tmpConfigTmpPath,
    await tr5StealthLimiter_buildFxChain(inputTmpPath, outputTmpPath, gain),
    'utf-8',
  );
  const uiSpinner = ora({
    text: chalk.bold.red.bgRgb(255, 255, 255)('Processing on VST ... Do not touch the new window.'),
    color: 'cyan',
    spinner: 'material',
  }).start();
  // console.log(chalk.bold.yellow.bgRgb(255, 0, 0)('=== Processing on VST... Do not touch the new window. ==='));
  await subProcessUtils.spawnAsync(
    path.resolve(appConfig.file.cliPath.reaper),
    ['-batchconvert', tmpConfigTmpPath, '-nosplash', '-noactivate'],
    {},
  );
  uiSpinner.stop();
  // process.stdout.write('\x1b[1A\x1b[2K');
  await subProcessUtils.spawnAsync('cmd.exe', ['/c', 'move', '/y', `${inputTmpPath}`, `${inputPath}`], {}, false);
  await subProcessUtils.spawnAsync('cmd.exe', ['/c', 'move', '/y', `${outputTmpPath}`, `${outputPath}`], {}, false);
  await fs.rm(tmpConfigTmpPath);
  if ((await fs.readFile(tmpConfigTmpPath + '.log', 'utf-8')).trim().endsWith('OK')) {
    logger.debug('Successful VST processing');
    await fs.rm(tmpConfigTmpPath + '.log');
  }
  await tr5StealthLimiter_preparePost(preparePreResult);
}

export default {
  reaperCleaning,
  tr5StealthLimiter_runPlugin,
};
