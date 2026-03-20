import { Vec2, Team, PlayerState } from '../types';
import { FIELD_WIDTH, FIELD_HEIGHT, GOAL_Y_MIN, GOAL_Y_MAX, PLAYER_RADIUS } from '../constants';
import { vec2 } from '../util/math';

/** Check if ball position is inside a goal. Returns scoring team or null. */
export function checkGoal(ballPos: Vec2): Team | null {
  if (ballPos.y < GOAL_Y_MIN || ballPos.y > GOAL_Y_MAX) return null;

  // Ball went past left edge → blue team scores (right team scored on left goal)
  if (ballPos.x < 0) return 'blue';
  // Ball went past right edge → red team scores
  if (ballPos.x > FIELD_WIDTH) return 'red';

  return null;
}

/** Get starting positions for players on a team. Spread evenly on their half. */
export function getStartingPositions(team: Team, count: number, halfSwapped: boolean): Vec2[] {
  const isLeftSide = (team === 'red') !== halfSwapped;
  const baseX = isLeftSide ? FIELD_WIDTH * 0.25 : FIELD_WIDTH * 0.75;
  const positions: Vec2[] = [];

  if (count === 1) {
    positions.push(vec2(baseX, FIELD_HEIGHT / 2));
  } else {
    const spacing = (FIELD_HEIGHT - PLAYER_RADIUS * 4) / (count - 1);
    for (let i = 0; i < count; i++) {
      positions.push(vec2(baseX, PLAYER_RADIUS * 2 + i * spacing));
    }
  }

  return positions;
}

/** Reset on-field players to starting positions and zero velocity. */
export function resetPlayersToPositions(players: PlayerState[], halfSwapped: boolean): void {
  const redOnField = players.filter((p) => p.team === 'red' && p.onField);
  const blueOnField = players.filter((p) => p.team === 'blue' && p.onField);

  const redPositions = getStartingPositions('red', redOnField.length, halfSwapped);
  const bluePositions = getStartingPositions('blue', blueOnField.length, halfSwapped);

  redOnField.forEach((p, i) => {
    p.position = redPositions[i];
    p.velocity = { x: 0, y: 0 };
    p.kickCooldown = 0;
  });

  blueOnField.forEach((p, i) => {
    p.position = bluePositions[i];
    p.velocity = { x: 0, y: 0 };
    p.kickCooldown = 0;
  });
}
