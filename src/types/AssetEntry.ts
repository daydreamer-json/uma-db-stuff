type AssetDbOriginalEntry = {
  i: string;
  n: string;
  d: string | null;
  g: string;
  l: string;
  c: string;
  h: string;
  m: string;
  k: string;
  s: 0 | 1;
  p: string;
  e: string;
};

const assetDbEntryKindArray = [
  '_3d_cutt',
  'announce',
  'atlas',
  'bg',
  'challengematch',
  'chara',
  'collectevent',
  'font',
  'fontresources',
  'gacha',
  'gachaselect',
  'guide',
  'heroes',
  'home',
  'imageeffect',
  'item',
  'jobs',
  'lipsync',
  'live',
  'loginbonus',
  'manifest',
  'manifest2',
  'manifest3',
  'mapevent',
  'master',
  'minigame',
  'mob',
  'movie',
  'outgame',
  'paddock',
  'race',
  'ratingrace',
  'shader',
  'single',
  'sound',
  'story',
  'storyevent',
  'supportcard',
  'teambuilding',
  'transferevent',
  'uianimation',
] as const;

type AssetDbEntryKind = (typeof assetDbEntryKindArray)[number];

type AssetDbConvertedEntry = {
  index: number;
  name: string;
  d: string | null;
  g: number;
  length: number;
  // pathId: string;
  hash: string;
  kind: AssetDbEntryKind | null;
  k: number;
  ondemand: boolean;
  p: number;
  encryptionKey: bigint;
};

export type { AssetDbOriginalEntry, AssetDbEntryKind, AssetDbConvertedEntry };
export { assetDbEntryKindArray };
