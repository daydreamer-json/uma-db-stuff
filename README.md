# uma-db-stuff

A set of experimental scripts to process Uma Musume Pretty Derby ( ウマ娘 プリティーダービー ) game assets and database files.

## What this scripts can do

- **Reproduction of in-game Winning Live audio**
  - Provides an interactive CLI for creating audio files that replicate the logic of Winning Live, which is parted and dynamically changes the volume / pan of the singing characters.
- Extract Unity AssetBundle files using AssetStudio
- Decrypt and decode CRI ACB/AWB files using vgmstream
- Dump all SQLite database (asset, master)

## Requirements

- Windows x86_64 Environment
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
- [qaac](https://github.com/nu774/qaac/)

## How to use

Download the latest build from the GitHub Releases page.  
Is the Releases page confusing? Please click [here](https://gitload.net/daydreamer-json/uma-db-stuff/).

Unzip to an appropriate location.

Open a terminal (`cmd`) in the root folder of the project (the folder with the application exe).

Let's get started by typing a command!

```powershell
# Show help
uma-db-stuff -h

# Generate Winning Live audio
uma-db-stuff live
```

When any command is executed, the location of the game's assets folder is automatically detected and a YAML file is automatically generated in the config folder.  
For details of each configuration item, please refer to the corresponding part of the source code ([config.ts](/src/utils/config.ts), [configUser.ts](/src/utils/configUser.ts)).

For more information on each command, see `uma-db-stuff <command> -h`.

## Build

```
bun run build
```
