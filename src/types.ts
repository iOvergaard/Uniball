export type Team = 'red' | 'blue';

export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: number;
  position: Vec2;
  velocity: Vec2;
  team: Team;
  kickCooldown: number;
  name: string;
  onField: boolean;
  /** Tick when this player was last benched (0 = started on bench). Used for fair rotation. */
  benchedAtTick: number;
}

export interface BallState {
  position: Vec2;
  velocity: Vec2;
}

export type MatchPhase = 'kickoff' | 'playing' | 'halftime' | 'overtime' | 'ended';

export interface GameState {
  tick: number;
  matchTime: number;
  phase: MatchPhase;
  kickoffCountdown: number;
  scoreRed: number;
  scoreBlue: number;
  players: PlayerState[];
  ball: BallState;
  halfSwapped: boolean;
  lastSubstitutionTime: number;
}

export interface InputFrame {
  dx: number;
  dy: number;
  kick: boolean;
}
