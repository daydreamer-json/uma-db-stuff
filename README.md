# uma-db-stuff

A set of experimental scripts to process Umamusume Pretty Derby game assets and database files.

## What this scripts can do

- Extract Unity AssetBundle files using AssetStudio
- Decrypt and decode CRI ACB/AWB files using vgmstream
- **Reproduction of in-game Winning Live audio**
  - Provides an interactive CLI for creating audio files that replicate the logic of Winning Live, which is parted and dynamically changes the volume / pan of the singing characters.

## Requirements

- [Node.js](https://nodejs.org/) >= v22
- [Windows (DMM) game client](https://dmg.umamusume.jp/)
  - DMM GAMES account is required. You must also be logged into the game at least once.

The binaries below are in the `bin` folder. No additional download is required.  
Licenses belong to the respective projects.

- [AssetStudioModCLI](https://github.com/aelurum/AssetStudio/)
- [vgmstream](https://vgmstream.org/)
- [FFmpeg](https://ffmpeg.org/)
- [SoX](https://sourceforge.net/projects/sox/)
- [FLAC](https://xiph.org/flac/)

## How to use

Edit the `config.json` file.  
Change `file.assetDir` and `file.sqlDbPath` to valid paths.  
Replace backslash (`\`) with slash (`/`).
There should probably be an appropriate folder in `C:\Users\USERNAME\AppData\LocalLow\Cygames\umamusume`.

Execute the following command in the project root directory.

```
npm run build && npm link
uma-db-stuff --help
```

The `path` argument of the `extractAssetBundles` and `extractCri` commands should be a path that exists in the meta database (e.g., `sound/l/1001`), not the actual file path.  
This is to search for asset entries in the meta database that match the path argument and process the hit assets.

For more information on each command, see `uma-db-stuff <command> --help`.