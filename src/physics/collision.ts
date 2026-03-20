import { Vec2 } from '../types';
import { vec2Sub, vec2Dist, vec2Normalize, vec2Dot, vec2Scale, vec2Add } from '../util/math';

interface Circle {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  mass: number;
}

/** Resolve overlap and exchange velocity between two circles (elastic collision). */
export function resolveCircleCircle(a: Circle, b: Circle): void {
  const diff = vec2Sub(a.position, b.position);
  const dist = vec2Dist(a.position, b.position);
  const minDist = a.radius + b.radius;

  if (dist >= minDist || dist === 0) return;

  const normal = vec2Normalize(diff);
  const overlap = minDist - dist;

  // Separate by inverse mass ratio
  const totalMass = a.mass + b.mass;
  a.position = vec2Add(a.position, vec2Scale(normal, overlap * (b.mass / totalMass)));
  b.position = vec2Add(b.position, vec2Scale(normal, -overlap * (a.mass / totalMass)));

  // Exchange velocity along collision normal
  const relVel = vec2Sub(a.velocity, b.velocity);
  const velAlongNormal = vec2Dot(relVel, normal);

  // Only resolve if objects are moving toward each other
  if (velAlongNormal > 0) return;

  const impulse = (-2 * velAlongNormal) / totalMass;
  a.velocity = vec2Add(a.velocity, vec2Scale(normal, impulse * b.mass));
  b.velocity = vec2Add(b.velocity, vec2Scale(normal, -impulse * a.mass));
}

/** Constrain a circle inside a rectangular boundary, reflecting velocity on bounce. */
export function resolveCircleWall(
  position: Vec2,
  velocity: Vec2,
  radius: number,
  fieldWidth: number,
  fieldHeight: number,
  restitution: number,
  goalYMin: number,
  goalYMax: number,
  isball: boolean,
): void {
  // Top wall
  if (position.y - radius < 0) {
    position.y = radius;
    velocity.y = Math.abs(velocity.y) * restitution;
  }
  // Bottom wall
  if (position.y + radius > fieldHeight) {
    position.y = fieldHeight - radius;
    velocity.y = -Math.abs(velocity.y) * restitution;
  }

  // Left wall (with goal opening for ball)
  if (position.x - radius < 0) {
    const inGoalY = position.y >= goalYMin && position.y <= goalYMax;
    if (isball && inGoalY) {
      // Ball entering left goal — don't bounce, let it through
    } else {
      position.x = radius;
      velocity.x = Math.abs(velocity.x) * restitution;
    }
  }
  // Right wall (with goal opening for ball)
  if (position.x + radius > fieldWidth) {
    const inGoalY = position.y >= goalYMin && position.y <= goalYMax;
    if (isball && inGoalY) {
      // Ball entering right goal — don't bounce, let it through
    } else {
      position.x = fieldWidth - radius;
      velocity.x = -Math.abs(velocity.x) * restitution;
    }
  }
}
