import child_process from 'node:child_process';
import chalk from 'chalk';
import open from 'open';
import prompts from 'prompts';
import exitUtils from './exit.js';
import logger from './logger.js';
import subProcessUtils from './subProcess.js';

async function checkRequirements() {
  logger.debug('Checking system requirements ...');
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    logger.fatal(`This platform is not supported: ${process.platform}, ${process.arch}`);
    await exitUtils.pressAnyKeyToExit(1);
  } else {
    logger.trace(`This platform is supported: ${process.platform}, ${process.arch}`);
  }
  const requirements: { key: string; pretty: string; url: string; isInstalled: boolean }[] = [
    {
      key: 'vcredist',
      pretty: 'Microsoft VC++ Redist',
      url: 'https://aka.ms/vs/17/release/vc_redist.x64.exe',
      isInstalled: await (async (): Promise<boolean> => {
        const regKey = 'HKLM\\SOFTWARE\\Microsoft\\VisualStudio\\14.0\\VC\\Runtimes\\x64';
        const regValueName = 'Installed';
        let isInstalled: boolean = false;
        try {
          const response = await subProcessUtils.spawnAsync('reg', ['query', regKey, '/v', regValueName], {});
          isInstalled = response.exitCode === 0 && /0x1/.test(response.stdout) === true;
        } catch (_) {}
        return isInstalled;
      })(),
    },
    {
      key: 'dotnet8',
      pretty: 'Microsoft .NET Desktop Runtime 8.0',
      url: 'https://aka.ms/dotnet/8.0/windowsdesktop-runtime-win-x64.exe',
      isInstalled: await (async (): Promise<boolean> => {
        let isInstalled: boolean = false;
        try {
          const response = await subProcessUtils.spawnAsync('dotnet', ['--list-runtimes'], {});
          if (response.exitCode === 0) {
            isInstalled = response.stdout
              .split(/\r?\n/)
              .some((line) => /^Microsoft\.WindowsDesktop\.App 8\.\d+\.\d+/.test(line));
          }
        } catch (_) {}
        return isInstalled;
      })(),
    },
  ];
  logger.trace(
    `Installed requirements: ${JSON.stringify(Object.fromEntries(requirements.map((obj) => [obj.key, obj.isInstalled])))}`,
  );
  for (const requirementsEntry of requirements) {
    if (requirementsEntry.isInstalled !== true) {
      logger.fatal(`${chalk.bold.red(`${requirementsEntry.pretty} is not installed.`)} Please install it`);
      if (
        (
          await prompts(
            {
              type: 'toggle',
              name: 'value',
              message: 'Do you want to download the installer?',
              initial: true,
              active: 'yes',
              inactive: 'no',
            },
            {
              onCancel: async () => {
                await exitUtils.exit(1, 'Aborted by user');
              },
            },
          )
        ).value
      ) {
        await open(requirementsEntry.url);
        // await exitUtils.pressAnyKeyToExit(1);
      } else {
      }
      await exitUtils.pressAnyKeyToExit(1);
    }
  }
}

async function checkIsAdmin() {
  const rsp = child_process.spawnSync('net', ['session']);
  if (rsp.status !== 0) {
    logger.error('This program must be run as an administrator');
    await exitUtils.pressAnyKeyToExit(1);
  }
}

async function checkIsGameRunning() {
  const processesToKill = ['umamusume', 'DMMGamePlayer']; // for safety and security
  const runningProcesses = child_process.spawnSync('tasklist').stdout.toString().replaceAll('\r\n', '\n').trim();
  const detectedProcesses = processesToKill.filter((processName) => runningProcesses.includes(processName));
  if (detectedProcesses.length > 0) {
    detectedProcesses.forEach((processName) =>
      logger.error(`Running unnecessary process detected: ${processName}.exe`),
    );
    const killProcesses = (
      await prompts(
        {
          type: 'toggle',
          name: 'value',
          message: 'Do you want to try to kill the process?',
          initial: true,
          active: 'yes (recommended)',
          inactive: 'no',
        },
        {
          onCancel: async () => {
            await exitUtils.exit(1, 'Aborted by user');
          },
        },
      )
    ).value as boolean;
    if (killProcesses) {
      logger.trace(`Killing process${detectedProcesses.length > 1 ? 'es' : ''} ...`);
      detectedProcesses.forEach((processName) => {
        const result = child_process.spawnSync('taskkill', ['/f', '/im', `${processName}.exe`]);
        if (result.status !== 0) {
          logger.error(`Failed to kill process: ${processName}.exe, Code: ${result.status}`);
        } else {
          logger.info(`Successfully killed process: ${processName}.exe`);
        }
      });
    }
  }
}

export default {
  checkRequirements,
  checkIsAdmin,
  checkIsGameRunning,
};
