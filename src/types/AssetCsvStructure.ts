type MusicscorePartOrig = {
  time: string;
  left3?: string;
  left2?: string;
  lleft?: string;
  left: string;
  center: string;
  right: string;
  rright?: string;
  right2?: string;
  right3?: string;
  left3_vol?: string;
  left2_vol?: string;
  lleft_vol?: string;
  left_vol?: string;
  center_vol?: string;
  right_vol?: string;
  rright_vol?: string;
  right2_vol?: string;
  right3_vol?: string;
  left3_pan?: string;
  left2_pan?: string;
  lleft_pan?: string;
  left_pan?: string;
  center_pan?: string;
  right_pan?: string;
  rright_pan?: string;
  right2_pan?: string;
  right3_pan?: string;
  volume_rate?: string;
};

type MusicscorePartTrackString = 'left3' | 'left2' | 'left' | 'center' | 'right' | 'right2' | 'right3';
const musicScorePartTrackStringSortedArray = ['center', 'left', 'right', 'left2', 'right2', 'left3', 'right3'] as const;
type MusicscorePartTrackStringSorted = (typeof musicScorePartTrackStringSortedArray)[number];

type MusicscorePartParsed = {
  timeMs: number;
  tracksEnable: {
    [key in MusicscorePartTrackString]: boolean;
  };
  tracks: {
    [key in MusicscorePartTrackString]: number;
  };
  volume: {
    [key in MusicscorePartTrackString]: number | null;
  };
  pan: {
    [key in MusicscorePartTrackString]: number | null;
  };
};

type MusicscorePartJson = {
  availableTrack: {
    [key in MusicscorePartTrackString]: boolean;
  };
  part: Array<MusicscorePartParsed>;
};

type MusicscoreLyricsOrig = {
  time: string;
  lyrics: string;
};

type MusicscoreLyricsParsed = {
  timeMs: number;
  lyrics: string;
};

type MusicscoreLyricsJson = {
  parsed: MusicscoreLyricsParsed[];
  lrcEncoded: string;
};

type MusicscoreCyalumeOrig = {
  time: string;
  move_type: string;
  bpm: string;
  color_pattern: string;
  color1: string;
  color2: string;
  color3: string;
  color4: string;
  color5: string;
  width1: string;
  width2: string;
  width3: string;
  width4: string;
  width5: string;
};

export type {
  MusicscorePartTrackString,
  MusicscorePartTrackStringSorted,
  MusicscorePartOrig,
  MusicscorePartParsed,
  MusicscorePartJson,
  MusicscoreLyricsOrig,
  MusicscoreLyricsParsed,
  MusicscoreLyricsJson,
  MusicscoreCyalumeOrig,
};

export { musicScorePartTrackStringSortedArray };
