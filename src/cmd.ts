import fs from 'fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import appConfig from './utils/config.js';
import testMainCmdHandler from './test.js';
import generateLiveAudioMainCmdHandler from './generateLiveAudio.js';
import updateMasterDbMainCmdHandler from './updateMasterDb.js';
import downloadMissingAssetsMainCmdHandler from './downloadMissingAssets.js';
import extractAssetBundlesMainCmdHandler from './extractAssetBundles.js';
import extractCriMainCmdHandler from './extractCri.js';
import argvUtils from './utils/argv.js';

async function parseCommand() {
  const yargsInstance = yargs(hideBin(process.argv));
  await yargsInstance
    .command(
      ['generateLiveAudio', 'live'],
      'Generate Winning Live audio',
      (yargs) => {
        yargs.options({
          'output-dir': {
            alias: ['o'],
            desc: 'Output root directory',
            default: path.resolve(appConfig.file.outputDir),
            normalize: true,
            type: 'string',
          },
          thread: {
            alias: ['t'],
            desc: 'Set network thread count',
            default: appConfig.network.threadCount,
            type: 'number',
          },
          'no-show-progress': {
            alias: ['np'],
            desc: 'Do not show download progress',
            default: false,
            type: 'boolean',
          },
          'log-level': {
            desc: 'Set log level',
            default: appConfig.logger.logLevel,
            deprecated: false,
            choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
            type: 'string',
          },
        });
      },
      async (argv) => {
        argvUtils.setArgv(argv);
        await generateLiveAudioMainCmdHandler();
      },
    )
    .command(
      ['updateMasterDb', 'update'],
      'Update master database',
      (yargs) => {
        yargs.options({
          'output-dir': {
            alias: ['o'],
            desc: 'Output root directory',
            default: path.resolve(appConfig.file.outputDir),
            normalize: true,
            type: 'string',
          },
          thread: {
            alias: ['t'],
            desc: 'Set network thread count',
            default: appConfig.network.threadCount,
            type: 'number',
          },
          'no-show-progress': {
            alias: ['np'],
            desc: 'Do not show download progress',
            default: false,
            type: 'boolean',
          },
          'log-level': {
            desc: 'Set log level',
            default: appConfig.logger.logLevel,
            deprecated: false,
            choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
            type: 'string',
          },
        });
      },
      async (argv) => {
        argvUtils.setArgv(argv);
        await updateMasterDbMainCmdHandler();
      },
    )
    .command(
      ['downloadMissingAssets', 'dlmiss'],
      'Download all missing assets to game directory',
      (yargs) => {
        yargs.options({
          thread: {
            alias: ['t'],
            desc: 'Set network thread count',
            default: appConfig.network.threadCount,
            type: 'number',
          },
          'no-show-progress': {
            alias: ['np'],
            desc: 'Do not show download progress',
            default: false,
            type: 'boolean',
          },
          'log-level': {
            desc: 'Set log level',
            default: appConfig.logger.logLevel,
            deprecated: false,
            choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
            type: 'string',
          },
        });
      },
      async (argv) => {
        argvUtils.setArgv(argv);
        await downloadMissingAssetsMainCmdHandler();
      },
    )
    .command(
      ['extractAssetBundles [path]', 'ab'],
      'Extract Unity AssetBundle files',
      (yargs) => {
        yargs
          .positional('path', {
            description: 'Path of assets to decrypt',
            type: 'string',
          })
          .options({
            'output-dir': {
              alias: ['o'],
              desc: 'Output root directory',
              default: path.resolve(appConfig.file.outputDir),
              normalize: true,
              type: 'string',
            },
            thread: {
              alias: ['t'],
              desc: 'Set network thread count',
              default: appConfig.network.threadCount,
              type: 'number',
            },
            'no-show-progress': {
              alias: ['np'],
              desc: 'Do not show download progress',
              default: false,
              type: 'boolean',
            },
            'log-level': {
              desc: 'Set log level',
              default: appConfig.logger.logLevel,
              deprecated: false,
              choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
              type: 'string',
            },
          });
      },
      async (argv) => {
        argvUtils.setArgv(argv);
        await extractAssetBundlesMainCmdHandler();
      },
    )
    .command(
      ['extractCri [path]', 'cri'],
      'Decrypt and extract CRI ACB/AWB audio files',
      (yargs) => {
        yargs
          .positional('path', {
            description: 'Path of assets to decrypt',
            type: 'string',
          })
          .options({
            'output-dir': {
              alias: ['o'],
              desc: 'Output root directory',
              default: path.resolve(appConfig.file.outputDir),
              normalize: true,
              type: 'string',
            },
            thread: {
              alias: ['t'],
              desc: 'Set network thread count',
              default: appConfig.network.threadCount,
              type: 'number',
            },
            'no-show-progress': {
              alias: ['np'],
              desc: 'Do not show download progress',
              default: false,
              type: 'boolean',
            },
            'log-level': {
              desc: 'Set log level',
              default: appConfig.logger.logLevel,
              deprecated: false,
              choices: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
              type: 'string',
            },
          });
      },
      async (argv) => {
        argvUtils.setArgv(argv);
        await extractCriMainCmdHandler();
      },
    )
    .scriptName(JSON.parse(await fs.promises.readFile('package.json', { encoding: 'utf-8' })).name)
    .usage('$0 <command> [argument] [option]')
    .help()
    .version()
    .demandCommand(1)
    .strict()
    .recommendCommands()
    .parse();
}

export default parseCommand;
