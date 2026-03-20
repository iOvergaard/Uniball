import { Vec2 } from '../types';
import { vec2Sub, vec2Dist, vec2Normalize, vec2Dot, vec2Scale } from '../util/math';

interface Circle {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  mass: number;
}

/** Resolve overlap and exchange velocity between two circles (elastic collision). Mutates in place. */
export function resolveCircleCircle(a: Circle, b: Circle): void {
  const diff = vec2Sub(a.position, b.position);
  const dist = vec2Dist(a.position, b.position);
  const minDist = a.radius + b.radius;

  if (dist >= minDist || dist === 0) return;

  const normal = vec2Normalize(diff);
  const overlap = minDist - dist;

  // Separate by inverse mass ratio (mutate in place)
  const totalMass = a.mass + b.mass;
  const sepA = vec2Scale(normal, overlap * (b.mass / totalMass));
  const sepB = vec2Scale(normal, -overlap * (a.mass / totalMass));
  a.position.x += sepA.x;
  a.position.y += sepA.y;
  b.position.x += sepB.x;
  b.position.y += sepB.y;

  // Exchange velocity along collision normal
  const relVel = vec2Sub(a.velocity, b.velocity);
  const velAlongNormal = vec2Dot(relVel, normal);

  // Only resolve if objects are moving toward each other
  if (velAlongNormal > 0) return;

  const impulse = (-2 * velAlongNormal) / totalMass;
  const impA = vec2Scale(normal, impulse * b.mass);
  const impB = vec2Scale(normal, -impulse * a.mass);
  a.velocity.x += impA.x;
  a.velocity.y += impA.y;
  b.velocity.x += impB.x;
  b.velocity.y += impB.y;
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
