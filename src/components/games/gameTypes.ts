export type TicTacToeState = {
  board: Array<'X' | 'O' | null>;
  winner: 'host' | 'guest' | 'draw' | null;
};

export type ChessState = {
  fen: string;
  winner: 'host' | 'guest' | 'draw' | null;
};

export type HandCricketState = {
  inning: number;
  p1Role: 'batting' | 'bowling';
  p1Choice: number | null;
  p2Choice: number | null;
  p1Score: number;
  p2Score: number;
  target: number | null;
  gameOver: boolean;
  result: 'host' | 'guest' | 'draw' | null;
  winner?: 'host' | 'guest' | 'draw' | null;
  round: number;
  lastC1?: number;
  lastC2?: number;
};

export type CarromState = {
  scores: { host: number; guest: number };
  pocketed: { white: number; black: number; queen: number };
  winner: 'host' | 'guest' | 'draw' | null;
  activeShotId: string | null;
  activeShotPlayer: string | null;
  scoresThisShot: number;
  lastShot?: {
    position: { x: number; y: number };
    force: { x: number; y: number };
  };
};

export type GameState = TicTacToeState | ChessState | HandCricketState | CarromState;

export type GameSyncEvent = {
  type: 'sync';
  state: GameState;
  isMyTurn: boolean;
};

export type GameAction =
  | { type: 'action'; index?: number; move?: string | { from: string; to: string; promotion?: string }; choice?: number; round?: number }
  | { type: 'shot'; shot: { position: { x: number; y: number }; force: { x: number; y: number } } }
  | { type: 'score'; foul?: boolean; label?: 'white' | 'black' | 'queen' }
  | { type: 'turn_end' }
  | { type: 'rematch' };
