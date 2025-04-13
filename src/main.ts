#!/usr/bin/env node

// import clear from 'clear';
// clear();
import childProcess from 'node:child_process';
import util from 'node:util';
import parseCommand from './cmd';
import exitUtils from './utils/exit';
const execPromise = util.promisify(childProcess.exec);

async function main(): Promise<void> {
  try {
    process.platform === 'win32' ? await execPromise('chcp 65001') : null;
    await parseCommand();
  } catch (error) {
    console.log(error);
    exitUtils.pressAnyKeyToExit(1);
  }
}

await main();
