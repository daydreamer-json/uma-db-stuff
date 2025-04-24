import bun from 'bun';
import path from 'node:path';
import YAML from 'yaml';
import deepmerge from 'deepmerge';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<{
  file: {
    // Various paths. Automatically detected and rewritten
    gameAssetDirPath: string | null;
    sqliteDbPath: {
      assetDb: string | null;
      masterDb: string | null;
    };
    assetUnityInternalPathDir: string;
    outputPath: string;
    outputSubPath: {
      assets: string;
      db: string;
      renderedAudio: string;
    };
  };
  audio: {
    useCheersInst: boolean; // Whether to include audience cheers in the live audio
    targetLoudness: number; // Target for volume normalization during winning live audio generation
    volumeCompensation: {
      //! Probably still does not work
      inst: number;
      vocal: number;
    };
    latencyCompensation: number; //! Not yet implemented
    useVSTLimiter: boolean; // Whether to use the VST's high-quality limiter for winning live audio generation. false will make the sound more susceptible to crackling.
  };
}>;

const initialConfig: ConfigType = {
  file: {
    gameAssetDirPath: null,
    sqliteDbPath: {
      assetDb: null,
      masterDb: null,
    },
    assetUnityInternalPathDir: '_gallopresources/bundle/resources',
    outputPath: path.resolve('output'),
    outputSubPath: {
      assets: 'assets',
      db: 'db',
      renderedAudio: 'mixAudio',
    },
  },
  audio: {
    useCheersInst: false,
    targetLoudness: -7.2,
    volumeCompensation: {
      inst: 0.0,
      vocal: 0.0,
    },
    latencyCompensation: 0,
    useVSTLimiter: true,
  },
};

const filePath = 'config/config_user.yaml';

if ((await bun.file(filePath).exists()) === false) {
  await bun.write(filePath, YAML.stringify(initialConfig, null, 2));
}

let config: ConfigType = await (async () => {
  const rawFileData: ConfigType = YAML.parse(await bun.file(filePath).text()) as ConfigType;
  const mergedConfig = deepmerge(initialConfig, rawFileData);
  if (JSON.stringify(rawFileData) !== JSON.stringify(mergedConfig)) {
    await bun.write(filePath, YAML.stringify(mergedConfig, null, 2));
  }
  return mergedConfig;
})();

export default {
  getConfig: () => config,
  setConfig: async (newValue: ConfigType) => {
    config = newValue;
    await bun.write(filePath, YAML.stringify(config, null, 2));
  },
};
