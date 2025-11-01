import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import cmds from './cmds.js';
import * as TypesLogLevels from './types/LogLevels.js';
import argvUtils from './utils/argv.js';
import appConfig from './utils/config.js';
import configEmbed from './utils/configEmbed.js';
import configUser from './utils/configUser.js';
import dbUtils from './utils/db.js';
import downloadUtils from './utils/download.js';
import exitUtils from './utils/exit.js';
import gameDirResolver from './utils/gameDirResolver.js';
import logger from './utils/logger.js';
import processUtils from './utils/process.js';

if (configEmbed.VERSION_NUMBER === null) throw new Error('Embed VERSION_NUMBER is null');

function wrapHandler(handler: (argv: any) => Promise<void>) {
  return async (argv: any) => {
    try {
      await handler(argv);
      await exitUtils.pressAnyKeyToExit(0);
    } catch (error) {
      // console.log(error);
      logger.error('Error caught:', error);
      await exitUtils.pressAnyKeyToExit(1);
    }
  };
}

async function parseCommand() {
  const yargsInstance = yargs(hideBin(process.argv));
  await yargsInstance
    // .command(
    //   ['test', '$0'],
    //   'Test command',
    //   (yargs) => {
    //     yargs.options({
    //       'output-dir': {
    //         alias: ['o'],
    //         desc: 'Output directory',
    //         default: configUser.getConfig().file.outputPath,
    //         normalize: true,
    //         type: 'string',
    //       },
    //       'thread-network': {
    //         alias: ['tn'],
    //         desc: 'Number of threads used for network',
    //         default: appConfig.threadCount.network,
    //         type: 'number',
    //       },
    //       'thread-processing': {
    //         alias: ['tp'],
    //         desc: 'Number of threads used for offline processing',
    //         default: appConfig.threadCount.processing,
    //         type: 'number',
    //       },
    //     });
    //   },
    //   wrapHandler(async () => {
    //     await testMainCmdHandler();
    //   }),
    // )
    .command(
      ['downloadMissingAssets', 'dlmiss'],
      'Download all missing assets to game directory',
      (yargs) => {
        yargs.options({
          'thread-network': {
            alias: ['tn'],
            desc: 'Number of threads used for network',
            default: appConfig.threadCount.network,
            type: 'number',
          },
          force: {
            alias: ['f'],
            desc: 'Force overwrite all assets (slow)',
            default: false,
            type: 'boolean',
          },
        });
      },
      wrapHandler(cmds.downloadMissingAssets),
    )
    .command(
      ['dumpMasterDb', 'dumpdb'],
      'Export all SQLite database to JSON, JSONL, YAML',
      (yargs) => {
        yargs.options({
          'output-dir': {
            alias: ['o'],
            desc: 'Output directory',
            default: configUser.getConfig().file.outputPath,
            normalize: true,
            type: 'string',
          },
          'thread-network': {
            alias: ['tn'],
            desc: 'Number of threads used for network',
            default: appConfig.threadCount.network,
            type: 'number',
          },
          'thread-processing': {
            alias: ['tp'],
            desc: 'Number of threads used for offline processing',
            default: appConfig.threadCount.processing,
            type: 'number',
          },
        });
      },
      wrapHandler(cmds.dumpMasterDb),
    )
    .command(
      ['extractAssetBundles [path]', 'ab'],
      'Extract Unity AssetBundle files',
      (yargs) => {
        yargs
          .positional('path', {
            description: 'Name of assets to decrypt',
            type: 'string',
          })
          .options({
            'output-dir': {
              alias: ['o'],
              desc: 'Output directory',
              default: configUser.getConfig().file.outputPath,
              normalize: true,
              type: 'string',
            },
            'thread-network': {
              alias: ['tn'],
              desc: 'Number of threads used for network',
              default: appConfig.threadCount.network,
              type: 'number',
            },
            'thread-processing': {
              alias: ['tp'],
              desc: 'Number of threads used for offline processing',
              default: appConfig.threadCount.processing,
              type: 'number',
            },
          });
      },
      wrapHandler(cmds.extractAssetBundles),
    )
    .command(
      ['extractCri [path]', 'cri'],
      'Decrypt and extract CRI ACB/AWB audio files',
      (yargs) => {
        yargs
          .positional('path', {
            description: 'Name of assets to decrypt',
            type: 'string',
          })
          .options({
            'output-dir': {
              alias: ['o'],
              desc: 'Output directory',
              default: configUser.getConfig().file.outputPath,
              normalize: true,
              type: 'string',
            },
            'thread-network': {
              alias: ['tn'],
              desc: 'Number of threads used for network',
              default: appConfig.threadCount.network,
              type: 'number',
            },
            'thread-processing': {
              alias: ['tp'],
              desc: 'Number of threads used for offline processing',
              default: appConfig.threadCount.processing,
              type: 'number',
            },
          });
      },
      wrapHandler(cmds.extractCri),
    )
    .command(
      ['generateLiveAudio [liveId] [charaIds]', 'live'],
      'Generate Winning Live audio',
      (yargs) => {
        yargs
          .positional('liveId', {
            description: 'Live track ID',
            type: 'number',
          })
          .positional('charaIds', {
            description: 'Live singer chara IDs (comma-separated)',
            type: 'string',
          })
          .options({
            'output-dir': {
              alias: ['o'],
              desc: 'Output directory',
              default: configUser.getConfig().file.outputPath,
              normalize: true,
              type: 'string',
            },
            'thread-network': {
              alias: ['tn'],
              desc: 'Number of threads used for network',
              default: appConfig.threadCount.network,
              type: 'number',
            },
            'thread-processing': {
              alias: ['tp'],
              desc: 'Number of threads used for offline processing',
              default: appConfig.threadCount.processing,
              type: 'number',
            },
          });
      },
      wrapHandler(cmds.generateLiveAudio),
    )
    .command(
      ['openHandbook', 'handbook'],
      'Start HTTP server and open handbook',
      (yargs) => {
        yargs.options({
          'output-dir': {
            alias: ['o'],
            desc: 'Output directory',
            default: configUser.getConfig().file.outputPath,
            normalize: true,
            type: 'string',
          },
        });
      },
      wrapHandler(cmds.openHandbook),
    )
    .options({
      'no-show-progress': {
        alias: ['np'],
        desc: 'Do not show progress bar',
        default: false,
        type: 'boolean',
      },
      'log-level': {
        desc: 'Set log level (' + TypesLogLevels.LOG_LEVELS_NUM.join(', ') + ')',
        default: appConfig.logger.logLevel,
        // choices: TypesLogLevels.LOG_LEVELS_NUM,
        type: 'number',
        coerce: (arg: number): TypesLogLevels.LogLevelString => {
          if (arg < TypesLogLevels.LOG_LEVELS_NUM[0] || arg > TypesLogLevels.LOG_LEVELS_NUM.slice(-1)[0]!) {
            throw new Error(`Invalid log level: ${arg} (Expected: ${TypesLogLevels.LOG_LEVELS_NUM.join(', ')})`);
          } else {
            return TypesLogLevels.LOG_LEVELS[arg as TypesLogLevels.LogLevelNumber];
          }
        },
      },
    })
    .middleware(async (argv) => {
      argvUtils.setArgv(argv);
      logger.level = argvUtils.getArgv()['logLevel'];
      logger.trace('Process started');
      await processUtils.checkRequirements();
      await processUtils.checkIsAdmin();
      await processUtils.checkIsGameRunning();
      await gameDirResolver.resolveGameDir();
      await dbUtils.loadAllDb(false);
      await downloadUtils.forceDownloadMasterDb();
    })
    .scriptName(configEmbed.APPLICATION_NAME)
    .version(configEmbed.VERSION_NUMBER!)
    .usage('$0 <command> [argument] [option]')
    .help()
    .alias('help', 'h')
    .alias('help', '?')
    .alias('version', 'V')
    .demandCommand(1)
    .strict()
    .recommendCommands()
    .parse();
}

export default parseCommand;
