#!/usr/bin/env node

// import clear from 'clear';
// clear();

//* Integer values stored in the SQLite database may be of type bigint.
//* Use this workaround to suppress errors when executing JSON.stringify().
// @ts-ignore
// tslint:disable-next-line:typedef
BigInt.prototype.toJSON = function () {
  return this.toString();
};

import childProcess from 'node:child_process';
import util from 'node:util';
import parseCommand from './cmd.js';
import exitUtils from './utils/exit.js';

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

main();
