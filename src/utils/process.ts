import bun from 'bun';
import prompts from 'prompts';
import logger from './logger';
import exitUtils from './exit';

async function checkIsAdmin() {
  const rsp = bun.spawnSync(['net', 'session']);
  if (rsp.exitCode !== 0 || !rsp.success) {
    logger.error('This program must be run as an administrator');
    await exitUtils.pressAnyKeyToExit(1);
  }
}

async function checkIsGameRunning() {
  const processesToKill = ['umamusume', 'DMMGamePlayer']; // for safety and security
  const runningProcesses = bun.spawnSync(['tasklist']).stdout;
  const detectedProcesses = processesToKill.filter((processName) => runningProcesses.includes(processName));
  if (detectedProcesses.length > 0) {
    detectedProcesses.forEach((processName) =>
      logger.error(`Running unnecessary process detected: ${processName}.exe`),
    );
    const killProcesses = (
      await prompts({
        type: 'toggle',
        name: 'value',
        message: 'Do you want to try to kill the process?',
        initial: true,
        active: 'yes (recommended)',
        inactive: 'no',
      })
    ).value as boolean;
    if (killProcesses) {
      logger.trace(`Killing process${detectedProcesses.length > 1 ? 'es' : ''} ...`);
      detectedProcesses.forEach((processName) => {
        const result = bun.spawnSync(['taskkill', '/f', '/im', `${processName}.exe`]);
        if (result.exitCode !== 0 || !result.success) {
          logger.error(`Failed to kill process: ${processName}.exe, Code: ${result.exitCode}`);
        } else {
          logger.info(`Successfully killed process: ${processName}.exe`);
        }
      });
    }
  }
}

export default {
  checkIsAdmin,
  checkIsGameRunning,
};
