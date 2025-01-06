import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import path from 'path';
import appConfig from './utils/config.js';
import testMainCmdHandler from './test.js';
import test2MainCmdHandler from './test2.js';
import argvUtils from './utils/argv.js';

async function parseCommand() {
  const yargsInstance = yargs(hideBin(process.argv));
  await yargsInstance
    .command(
      'test',
      'Test command',
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
        await testMainCmdHandler();
      },
    )
    .command(
      'test2',
      'Test command 2',
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
        await test2MainCmdHandler();
      },
    )
    .usage('$0 <command> [argument] [option]')
    .help()
    .version()
    .demandCommand(1)
    .strict()
    .recommendCommands()
    .parse();
}

export default parseCommand;
