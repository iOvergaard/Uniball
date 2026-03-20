import { GameState } from '../types';
import { Camera } from './camera';
import {
  FIELD_WIDTH, FIELD_HEIGHT,
  GOAL_HEIGHT, GOAL_WIDTH, GOAL_Y_MIN,
  CENTER_CIRCLE_RADIUS,
  PLAYER_RADIUS, BALL_RADIUS,
  RED_TEAM_COLOR, BLUE_TEAM_COLOR,
  FIELD_COLOR, FIELD_LINE_COLOR, BALL_COLOR,
} from '../constants';

export function render(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  camera: Camera,
): void {
  const { scale, offsetX, offsetY } = camera;

  // Clear
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawField(ctx);
  drawBall(ctx, state);
  drawPlayers(ctx, state);
  drawHUD(ctx, state);

  ctx.restore();
}

function drawField(ctx: CanvasRenderingContext2D): void {
  // Green pitch
  ctx.fillStyle = FIELD_COLOR;
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  ctx.strokeStyle = FIELD_LINE_COLOR;
  ctx.lineWidth = 2;

  // Boundary
  ctx.strokeRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  // Center line
  ctx.beginPath();
  ctx.moveTo(FIELD_WIDTH / 2, 0);
  ctx.lineTo(FIELD_WIDTH / 2, FIELD_HEIGHT);
  ctx.stroke();

  // Center circle
  ctx.beginPath();
  ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, CENTER_CIRCLE_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.fillStyle = FIELD_LINE_COLOR;
  ctx.beginPath();
  ctx.arc(FIELD_WIDTH / 2, FIELD_HEIGHT / 2, 4, 0, Math.PI * 2);
  ctx.fill();

  // Goals
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  // Left goal
  ctx.fillRect(-GOAL_WIDTH, GOAL_Y_MIN, GOAL_WIDTH, GOAL_HEIGHT);
  ctx.strokeRect(-GOAL_WIDTH, GOAL_Y_MIN, GOAL_WIDTH, GOAL_HEIGHT);
  // Right goal
  ctx.fillRect(FIELD_WIDTH, GOAL_Y_MIN, GOAL_WIDTH, GOAL_HEIGHT);
  ctx.strokeRect(FIELD_WIDTH, GOAL_Y_MIN, GOAL_WIDTH, GOAL_HEIGHT);
}

function drawBall(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { ball } = state;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
  ctx.beginPath();
  ctx.arc(ball.position.x + 2, ball.position.y + 2, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Ball
  ctx.fillStyle = BALL_COLOR;
  ctx.beginPath();
  ctx.arc(ball.position.x, ball.position.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ccc';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawPlayers(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const player of state.players) {
    const color = player.team === 'red' ? RED_TEAM_COLOR : BLUE_TEAM_COLOR;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(player.position.x + 2, player.position.y + 2, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Team-colored circle
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(player.position.x, player.position.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Unicorn emoji
    ctx.font = `${PLAYER_RADIUS * 1.3}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🦄', player.position.x, player.position.y + 1);

    // Player name
    ctx.font = '10px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(player.name, player.position.x, player.position.y - PLAYER_RADIUS - 4);
  }
}

function drawHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Score
  const scoreText = `${state.scoreRed} - ${state.scoreBlue}`;
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Background for score
  const metrics = ctx.measureText(scoreText);
  const pad = 12;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(
    FIELD_WIDTH / 2 - metrics.actualBoundingBoxRight - pad,
    -36,
    (metrics.actualBoundingBoxRight + pad) * 2,
    34,
  );

  // Team colors in score
  ctx.fillStyle = RED_TEAM_COLOR;
  ctx.textAlign = 'right';
  ctx.fillText(`${state.scoreRed}`, FIELD_WIDTH / 2 - 10, -34);

  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('-', FIELD_WIDTH / 2, -34);

  ctx.fillStyle = BLUE_TEAM_COLOR;
  ctx.textAlign = 'left';
  ctx.fillText(`${state.scoreBlue}`, FIELD_WIDTH / 2 + 10, -34);

  // Timer
  const minutes = Math.floor(state.matchTime / 60);
  const seconds = Math.floor(state.matchTime % 60);
  const timerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(timerText, FIELD_WIDTH / 2, FIELD_HEIGHT + 8);

  // Phase indicator
  if (state.phase === 'kickoff') {
    const countdown = Math.ceil(state.kickoffCountdown / 60);
    const text = countdown > 0 ? `${countdown}` : 'GO!';
    ctx.font = 'bold 48px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  }

  if (state.phase === 'ended') {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const winner = state.scoreRed > state.scoreBlue ? 'Red Wins!'
      : state.scoreBlue > state.scoreRed ? 'Blue Wins!'
      : 'Draw!';
    ctx.fillText(winner, FIELD_WIDTH / 2, FIELD_HEIGHT / 2);
  }
}
