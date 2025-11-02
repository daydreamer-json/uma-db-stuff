import fs from 'node:fs';
import path from 'node:path';
import stream from 'node:stream';
import util from 'node:util';

// import logger from './logger.js';

async function checkFolderExists(folderPath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(folderPath);
    return stats.isDirectory();
  } catch (error: any) {
    return false;
  }
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.promises.stat(filePath);
    return stats.isFile();
  } catch (error: any) {
    return false;
  }
}

// async function getFileList(dirPath: string): Promise<string[]> {
//   const filePaths: string[] = [];
//   const scanner = new bun.Glob('**/*').scan({
//     cwd: dirPath,
//     absolute: true,
//     onlyFiles: true,
//   });
//   for await (const filePath of scanner) filePaths.push(filePath);
//   return filePaths;
// }

async function getFileList(dirPath: string): Promise<string[]> {
  const absoluteDirPath = path.resolve(dirPath);
  const filePaths: string[] = [];
  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        filePaths.push(fullPath);
      }
    }
  }
  await walk(absoluteDirPath);
  return filePaths;
}

async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

async function copyFileWithStream(srcPath: string, destPath: string): Promise<void> {
  const pipelineAsync = util.promisify(stream.pipeline);
  try {
    await pipelineAsync(fs.createReadStream(srcPath), fs.createWriteStream(destPath));
  } catch (err) {
    throw err;
  }
}

export default {
  checkFolderExists,
  checkFileExists,
  getFileList,
  readFileAsArrayBuffer,
  copyFileWithStream,
};
