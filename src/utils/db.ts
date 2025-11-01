import path from 'node:path';
import betterSqliteDb from 'better-sqlite3-multiple-ciphers';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import * as TypesAssetEntry from '../types/AssetEntry.js';
import * as TypesGeneric from '../types/Generic.js';
import argvUtils from './argv.js';
import assetsUtils from './assets.js';
import appConfig from './config.js';
import configUser from './configUser.js';
import logger from './logger.js';
import mathUtils from './math.js';

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
      const orig = await loadDb(
        configUser.getConfig().file.sqliteDbPath.assetDb!,
        generateDecryptionKey(
          hexToUint8Array(appConfig.cipher.sqliteDb.plainKey),
          hexToUint8Array(appConfig.cipher.sqliteDb.baseKey),
        ),
        true,
      );
      // console.log(orig['a'].map((e: any) => e.e));
      const pretty = convertAssetDbPretty(orig['a']);
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
  const masterDb = await loadDb(configUser.getConfig().file.sqliteDbPath.masterDb!, null);
  db = {
    assetDb,
    masterDb,
  };
}

async function loadDb(filePath: string, decryptionKey: Uint8Array | null, defaultSafeIntegers: boolean = false) {
  logger.debug(`Connected to the SQLite database: '${path.basename(filePath)}'`);
  const sqliteDb = new betterSqliteDb(filePath);
  sqliteDb.defaultSafeIntegers(defaultSafeIntegers);
  if (decryptionKey !== null) {
    logger.trace('Decrypting database with:');
    logger.trace('    Plain key: ' + appConfig.cipher.sqliteDb.plainKey);
    logger.trace('    XOR key:   ' + appConfig.cipher.sqliteDb.baseKey);
    logger.trace('    Final key: ' + Buffer.from(decryptionKey).toString('hex'));
    sqliteDb.pragma(`hexkey = '${Buffer.from(decryptionKey).toString('hex')}'`);
  }
  const getTablesName = async (): Promise<string[]> => {
    const stmt = sqliteDb.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`);
    const rows = stmt.all() as { name: string }[];
    return rows.map((row) => row.name);
  };
  const getTableData = async (tableName: string): Promise<Array<{ [key: string]: any }>> => {
    const stmt = sqliteDb.prepare(`SELECT * FROM \`${tableName}\``);
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
          argvUtils.getArgv()['noShowProgress'] === false
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
          argvUtils.getArgv()['noShowProgress']
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
    encryptionKey: BigInt(entry.e),
  }));
}

function hexToUint8Array(hex: string): Uint8Array {
  const trimmed = hex.replace(/^0x/, '');
  if (trimmed.length % 2 !== 0) throw new Error('Invalid hex string length');
  return new Uint8Array(trimmed.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
}

function generateDecryptionKey(plainKey: Uint8Array, baseKey: Uint8Array) {
  if (baseKey.length < 13) throw new Error('Invalid Base Key length');
  const result = new Uint8Array(plainKey.length);
  for (let i = 0; i < plainKey.length; i++) {
    result[i] = plainKey[i]! ^ baseKey[i % 13]!; //! Non-null assertion is dangerous
  }
  return result;
}

export default {
  getDb,
  loadAllDb,
};
