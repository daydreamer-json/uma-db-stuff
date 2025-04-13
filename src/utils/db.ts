import path from 'node:path';
import * as sqlite from 'bun:sqlite';
import cliProgress from 'cli-progress';
import chalk from 'chalk';
import logger from './logger';
import appConfig from './config';
import configUser from './configUser';
import argvUtils from './argv';
import assetsUtils from './assets';
import mathUtils from './math';
import * as TypesAssetEntry from '../types/AssetEntry';
import * as TypesGeneric from '../types/Generic';

let db: {
  assetDb: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[];
  masterDb: TypesGeneric.NestedObject;
} | null = null;

async function getDb(): Promise<{
  assetDb: (TypesAssetEntry.AssetDbConvertedEntry & { isFileExists: boolean })[];
  masterDb: TypesGeneric.NestedObject;
}> {
  if (db === null) await loadAllDb(false);
  return db!;
}

async function loadAllDb(onlyMasterDb: boolean) {
  logger.info(onlyMasterDb ? 'Loading SQLite master database ...' : 'Loading SQLite database ...');
  const assetDb = await (async () => {
    if (onlyMasterDb === true && db !== null) return db.assetDb;
    else {
      const orig = await loadDb(configUser.getConfig().file.sqliteDbPath.assetDb!);
      const pretty = convertAssetDbPretty(orig.a);
      const existsChecked = await assetsUtils.assetsFileExistsCheck(pretty);
      return existsChecked;
    }
  })();
  !onlyMasterDb
    ? logger.trace(
        `Exists: ${chalk.green.bold(assetDb.filter((entry) => entry.isFileExists === true).length)}, NotExists: ${(() => {
          const count = assetDb.filter((entry) => entry.isFileExists === false).length;
          const color = count === 0 ? chalk.green : chalk.red;
          return color.bold(count);
        })()}, OnDemandFlagged: ${chalk.yellow(assetDb.filter((entry) => entry.ondemand === true).length)}`,
      )
    : null;
  const masterDb = await loadDb(configUser.getConfig().file.sqliteDbPath.masterDb!);
  db = {
    assetDb,
    masterDb,
  };
}

async function loadDb(filePath: string) {
  const sqLiteDb = new sqlite.Database(filePath);
  logger.debug(`Connected to the SQLite database: '${path.basename(filePath)}'`);
  const getTablesName = async (): Promise<string[]> => {
    const stmt = sqLiteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    const rows = stmt.all() as { name: string }[];
    return rows.map((row) => row.name);
  };
  const getTableData = async (tableName: string): Promise<Array<{ [key: string]: any }>> => {
    const stmt = sqLiteDb.prepare(`SELECT * FROM \`${tableName}\``);
    const rows = stmt.all() as { [key: string]: any }[];
    return rows;
  };
  const allTablesData = await (async () => {
    try {
      const tablesName = await getTablesName();
      const tableDataArray: Array<{
        tableName: string;
        data: Array<{ [key: string]: any }>;
      }> = [];
      await (async () => {
        const progressBar =
          argvUtils.getArgv().noShowProgress === false
            ? new cliProgress.SingleBar({
                format: '{bar} {percentageFmt}% | {valueFmt} / {totalFmt} | {tableName}',
                ...appConfig.logger.progressBarConfig,
              })
            : null;
        const progressBarFormatter = (currentValue: number, totalValue: number) => {
          return {
            percentageFmt: mathUtils.rounder('ceil', (currentValue / totalValue) * 100, 2).padded.padStart(6, ' '),
            valueFmt: String(currentValue).padStart(String(totalValue).length, ' '),
            totalFmt: String(totalValue).padStart(String(totalValue).length, ' '),
          };
        };
        let loadedCount = 0;
        progressBar?.start(tablesName.length, loadedCount, {
          tableName: tablesName[0],
          ...progressBarFormatter(loadedCount, tablesName.length),
        });
        for (const [i, tableName] of tablesName.entries()) {
          const data = await getTableData(tableName);
          tableDataArray.push({ tableName, data });
          argvUtils.getArgv().noShowProgress
            ? logger.trace(`Loaded table from '${path.basename(filePath)}': '${tableName}'`)
            : null;
          loadedCount++;
          progressBar?.update(loadedCount, {
            tableName: tablesName[i + 1] ?? tablesName[i],
            ...progressBarFormatter(loadedCount, tablesName.length),
          });
        }
        progressBar?.stop();
      })();

      return tableDataArray.reduce((acc: TypesGeneric.NestedObject, item) => {
        acc[item.tableName] = item.data;
        return acc;
      }, {});
    } catch (err: any) {
      logger.error('Error processing tables:', err.message);
      throw err;
    }
  })();
  return allTablesData;
}

function convertAssetDbPretty(
  assetDb: Array<TypesAssetEntry.AssetDbOriginalEntry>,
): Array<TypesAssetEntry.AssetDbConvertedEntry> {
  return assetDb.map((entry) => ({
    index: parseInt(entry.i),
    name: entry.n,
    d: entry.d,
    g: parseInt(entry.g),
    length: parseInt(entry.l),
    // pathId: entry.c,
    hash: entry.h,
    kind: TypesAssetEntry.assetDbEntryKindArray.includes(entry.m as TypesAssetEntry.AssetDbEntryKind)
      ? (entry.m as TypesAssetEntry.AssetDbEntryKind)
      : null,
    k: parseInt(entry.k),
    ondemand: entry.s === 0,
    p: parseInt(entry.p),
  }));
}

export default {
  getDb,
  loadAllDb,
};
