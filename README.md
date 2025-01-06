# uma-db-stuff

A set of experimental scripts to process Umamusume Pretty Derby game assets and database files.

## What this scripts can do

- Extract Unity AssetBundle files using AssetStudio
  - I have not yet implemented command line arguments, and at this time you can modify the source code to extract the assets of your choice
  - By default, all AssetBundles related to Winning Live are extracted
- Decrypt and decode CRI ACB/AWB files using vgmstream
  - As mentioned above, command line arguments are not yet implemented
- **Reproduction of in-game Winning Live audio**
  - Provides an interactive CLI for creating audio files that replicate the logic of Winning Live, which is parted and dynamically changes the volume / pan of the singing characters.

## How to use

Install Umamusume Pretty Derby Windows (DMM) client and login.

Edit the `config.json` file.  
Change `file.assetDir` and `file.sqlDbPath` to valid paths.  
There should probably be an appropriate folder in `C:\Users\USERNAME\AppData\LocalLow\Cygames\umamusume`.

Execute the following command in the project root directory.

```
npm run build
node dist/main.js test
node dist/main.js test2
```
