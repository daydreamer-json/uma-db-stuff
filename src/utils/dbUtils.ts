import path from 'node:path';
import sqlite3 from 'sqlite3';
import cliProgress from 'cli-progress';
import logger from './logger.js';
import appConfig from './config.js';
import argvUtils from './argv.js';
import * as TypesAssetEntry from '../types/AssetEntry.js';
import * as TypesGeneric from '../types/Generic.js';
import assetUtils from './assetUtils.js';

async function loadAllDatabase() {
  logger.info('Loading SQLite database ...');
  const assetDb = await (async () => {
    const orig = await loadDb(appConfig.file.sqlDbPath.assetDb);
    const pretty = convertAssetDbPretty(orig.a);
    const existsChecked = await assetUtils.assetsFileExistsCheck(pretty);
    return existsChecked;
  })();
  logger.trace(
    `Exists: ${assetDb.filter((entry) => entry.isFileExists === true).length}, NotExists: ${
      assetDb.filter((entry) => entry.isFileExists === false).length
    }, OnDemandFlagged: ${assetDb.filter((entry) => entry.ondemand === true).length}`,
  );
  const masterDb = await loadDb(appConfig.file.sqlDbPath.masterDb);
  return {
    assetDb,
    masterDb,
  };
}

async function loadDb(filePath: string) {
  const db = new sqlite3.Database(filePath, sqlite3.OPEN_READONLY, (err) => {
    if (err) {
      logger.error('Error opening database:', err.message);
      throw err;
    }
    logger.debug(`Connected to the SQLite database: '${path.basename(filePath)}'`);
  });

  const getTablesName = (): Promise<Array<string>> => {
    return new Promise((resolve, reject) => {
      const query = `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`;
      db.all(query, (err, rows: Array<{ name: string }>) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows.map((row) => row.name));
      });
    });
  };

  const getTableData = (tableName: string): Promise<Array<{ [key: string]: any }>> => {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM ${tableName}`;
      // SELECT field_name FROM table_Name WHERE expression
      db.all(query, (err, rows: Array<{ [key: string]: any }>) => {
        if (err) {
          reject(err);
          return;
        }
        // logger.trace(`Loaded table from '${path.basename(filePath)}': '${tableName}'`);
        resolve(rows);
      });
    });
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
                format: '{bar} {percentage}% | {value}/{total} | {duration_formatted}/{eta_formatted} | {tableName}',
                ...appConfig.logger.progressBarConfig,
              })
            : null;
        progressBar?.start(tablesName.length, 0, {
          tableName: tablesName[0],
        });
        for (let i = 0; i < tablesName.length; i++) {
          const data = await getTableData(tablesName[i]);
          tableDataArray.push({ tableName: tablesName[i], data });
          argvUtils.getArgv().noShowProgress
            ? logger.trace(`Loaded table from '${path.basename(filePath)}': '${tablesName[i]}'`)
            : null;
          progressBar?.increment(1, {
            tableName: tablesName[i + 1] ?? tablesName[i],
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
  loadAllDatabase,
};
