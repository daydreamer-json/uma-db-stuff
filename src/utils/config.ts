import fs from 'fs';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    file: {
      assetStudioCliPath: string;
      vgmstreamCliPath: string;
      flacCliPath: string;
      soxCliPath: string;
      assetDir: string;
      assetUnityInternalPathDir: string;
      sqlDbPath: {
        assetDb: string;
        masterDb: string;
      };
      outputDir: string;
    };
    audio: {
      targetLoudness: number;
    };
    network: {
      assetApi: {
        baseDomain: string;
        apiPath: string;
        endpoint: {
          manifest: string;
          generic: string;
          assetBundle: string;
        };
      };
      userAgent: {
        chromeWindows: string;
        curl: string;
        curlUnity: string;
        ios: string;
      };
      timeout: number;
      threadCount: number;
    };
    logger: {
      logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
      progressBarConfig: {
        barCompleteChar: string;
        barIncompleteChar: string;
        hideCursor: boolean;
        barsize: number;
        fps: number;
        clearOnComplete: boolean;
      };
    };
  }>
>;

const config: ConfigType = JSON.parse(await fs.promises.readFile('config/config.json', 'utf-8'));

export default config;
