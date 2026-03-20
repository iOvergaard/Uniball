// === Field ===
export const FIELD_WIDTH = 840;
export const FIELD_HEIGHT = 400;
export const GOAL_WIDTH = 10;
export const GOAL_HEIGHT = 120;
export const CENTER_CIRCLE_RADIUS = 70;

// Goal Y range (centered vertically)
export const GOAL_Y_MIN = (FIELD_HEIGHT - GOAL_HEIGHT) / 2;
export const GOAL_Y_MAX = (FIELD_HEIGHT + GOAL_HEIGHT) / 2;

// === Player ===
export const PLAYER_RADIUS = 15;
export const PLAYER_MASS = 1.0;
export const PLAYER_DAMPING = 0.96;
export const PLAYER_ACCEL = 0.8;
export const MAX_PLAYER_SPEED = 5.0;

// === Ball ===
export const BALL_RADIUS = 10;
export const BALL_MASS = 0.5;
export const BALL_DAMPING = 0.99;

// === Kick ===
export const KICK_RANGE = PLAYER_RADIUS + BALL_RADIUS + 5;
export const KICK_FORCE = 12.0;
export const KICK_COOLDOWN_TICKS = 15;

// === Collision ===
export const WALL_RESTITUTION_PLAYER = 0.5;
export const WALL_RESTITUTION_BALL = 0.8;

// === Substitution ===
export const MAX_ON_FIELD_PER_TEAM = 4;
export const SUBSTITUTION_INTERVAL_SECONDS = 60;

// === Timing ===
export const TICK_RATE = 60;
export const TICK_DURATION = 1000 / TICK_RATE;
export const MATCH_DURATION_SECONDS = 300; // 5 minutes
export const HALFTIME_SECONDS = MATCH_DURATION_SECONDS / 2;
export const KICKOFF_COUNTDOWN_TICKS = 180; // 3 seconds
export const OVERTIME_DURATION_SECONDS = 60; // 1 minute sudden death

// === Networking ===
export const STATE_BROADCAST_RATE = 20; // Hz — host broadcasts state snapshots
export const STATE_BROADCAST_INTERVAL = 1000 / STATE_BROADCAST_RATE;
export const INTERPOLATION_BUFFER_MS = 50; // Client render delay for smooth interpolation
export const INPUT_BUFFER_TICKS = 10; // Replay last input for N ticks on packet loss
export const DISCONNECT_GRACE_TICKS = 300; // 5 seconds grace period before treating as leave

// === Protocol message types ===
export const MSG_INPUT = 1;
export const MSG_STATE = 2;
export const MSG_LOBBY_JOIN = 10;
export const MSG_LOBBY_TEAM = 11;
export const MSG_LOBBY_START = 12;
export const MSG_LOBBY_WELCOME = 13;
export const MSG_LOBBY_PLAYER_LIST = 14;

// === Rendering ===
export const CANVAS_PADDING = 40;

// === Team colors ===
export const RED_TEAM_COLOR = '#e63946';
export const BLUE_TEAM_COLOR = '#457b9d';
export const RED_TEAM_LIGHT = '#ff6b6b';
export const BLUE_TEAM_LIGHT = '#74c0fc';
export const FIELD_COLOR = '#2d6a4f';
export const FIELD_LINE_COLOR = 'rgba(255, 255, 255, 0.4)';
export const BALL_COLOR = '#ffffff';
