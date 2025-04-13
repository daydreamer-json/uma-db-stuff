import readline from 'node:readline';
import appConfig from './config';

async function pressAnyKeyToExit(errorCode: number): Promise<void> {
  if (errorCode !== 0) console.error('An error occurred');
  if (!process.stdin.isTTY || (appConfig.cli.autoExit && errorCode === 0)) {
    console.log(`Exiting with code ${errorCode} ...`);
    process.exit(errorCode);
  }
  process.stdout.write('Press any key to exit ...');
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write(` Exiting with code ${errorCode} ...\n`);
      resolve(); // Promiseを解決
      process.exit(errorCode); // その後、プロセスを終了
    });
  });
}

export default {
  pressAnyKeyToExit,
};
