import bun from 'bun';
import YAML from 'yaml';
import * as TypesLogLevels from '../types/LogLevels';

type Freeze<T> = Readonly<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;
type AllRequired<T> = Required<{
  [P in keyof T]: T[P] extends object ? Freeze<T[P]> : T[P];
}>;

type ConfigType = AllRequired<
  Freeze<{
    file: {
      cliPath: {
        // Specify the paths to various external command line tools. By default, the bundled ones are used.
        assetStudio: string;
        vgmstream: string;
        ffmpeg: string;
        flac: string;
        metaflac: string;
        opusenc: string;
        qaac: string;
        sox: string;
        reaper: string;
      };
      // Specify the paths to VST plugins. By default, the bundled ones are used.
      vstPath: {
        tr5: string;
      };
    };
    cipher: {
      // Key for decrypting CRI HCA audio and CRI USM video.
      cri: {
        hca: string; // hex
        usm: string; // hex
      };
    };
    network: {
      assetApi: {
        // API used when downloading game assets
        baseDomain: string;
        apiPath: string;
        endpoint: {
          manifest: string;
          generic: string;
          assetBundle: string;
        };
      };
      userAgent: {
        // UA to hide the fact that the access is from this tool
        chromeWindows: string;
        curl: string;
        curlUnity: string;
        ios: string;
      };
      timeout: number; // Network timeout
      retryCount: number; // Number of retries for DL failure
    };
    threadCount: {
      // Upper limit on the number of threads for parallel processing
      network: number; // network access
      processing: number; // offline processing (e.g., asset extraction)
    };
    cli: {
      autoExit: boolean; // Whether to exit the tool without waiting for key input when the exit code is 0
    };
    logger: {
      // log4js-node logger settings
      logLevel: TypesLogLevels.LogLevelNumber;
      useCustomLayout: boolean;
      customLayoutPattern: string;
      progressBarConfig: {
        // cli-progress settings
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

const initialConfig: ConfigType = {
  file: {
    cliPath: {
      assetStudio: './bin/assetstudio/AssetStudioModCLI.exe',
      vgmstream: './bin/vgmstream/vgmstream-cli.exe',
      ffmpeg: './bin/ffmpeg/ffmpeg.exe',
      flac: './bin/flac/flac.exe',
      metaflac: './bin/flac/metaflac.exe',
      opusenc: './bin/opus/opusenc.exe',
      qaac: './bin/qaac/qaac64.exe',
      sox: './bin/sox.exe',
      reaper: './bin/reaper/reaper.exe',
    },
    vstPath: {
      tr5: './bin/reaper/VST/tr5_stealth_limiter.vst3',
    },
  },
  cipher: {
    cri: {
      hca: '0000450d608c479f',
      usm: '0000450d608c479f',
    },
  },
  network: {
    assetApi: {
      baseDomain: 'prd-storage-game-umamusume.akamaized.net',
      apiPath: 'dl/resources',
      endpoint: {
        manifest: 'Manifest',
        generic: 'Generic',
        assetBundle: 'Windows/assetbundles',
      },
    },
    userAgent: {
      chromeWindows:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
      curl: 'curl/8.4.0',
      curlUnity: 'UnityPlayer/2022.3.21f1 (UnityWebRequest/1.0, libcurl/8.5.0-DEV)',
      ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    },
    timeout: 20000,
    retryCount: 5,
  },
  threadCount: {
    network: 8,
    processing: 12,
  },
  cli: {
    autoExit: false,
  },
  logger: {
    logLevel: 0,
    useCustomLayout: true,
    customLayoutPattern: '%[%d{hh:mm:ss.SSS} %-5.0p >%] %m',
    progressBarConfig: {
      barCompleteChar: '#',
      barIncompleteChar: '.',
      hideCursor: false,
      barsize: 40,
      fps: 10,
      clearOnComplete: true,
    },
  },
};

const filePath = 'config/config.yaml';

if ((await bun.file(filePath).exists()) === false) {
  await bun.write(filePath, YAML.stringify(initialConfig, null, 2));
}

const config: ConfigType = YAML.parse(await bun.file(filePath).text());

export default config;
