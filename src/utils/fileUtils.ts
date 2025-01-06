import fs from 'node:fs';
import path from 'node:path';

const exists = async (path: string) =>
  !!(await fs.promises
    .access(path)
    .then(() => true)
    .catch(() => false));

const getAllFilePaths = async (dirPath: string): Promise<Array<string>> => {
  let files: Array<string> = [];
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await getAllFilePaths(fullPath);
      files = files.concat(subFiles);
    } else {
      files.push(fullPath);
    }
  }
  return files;
};

export default {
  exists,
  getAllFilePaths,
};
