// NOVA DRIFT — the screenshot scenes behind ?shot=start|play|surge|end.
// One file, one job: play the real rules forward from a fresh world with a
// simple autopilot, so each frame is what a short game really looks like and
// the same seed always gives the same frame.

import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const SURGE_SECONDS = 100;
const END_LIMIT_SECONDS = 600;

/**
 * Steer the ship: drift toward the nearest ember or power-up, away from
 * close shards. `skill` 1.0 plays well; lower values notice danger later
 * and chase less, so a hurried player gets caught out. Skill 0 is
 * suicidal: it steers straight at the nearest shard.
 */
function autopilot(state, skill) {
  const player = state.player;
  let moveX = 0;
  let moveY = 0;

  // Skill 0: fly into the nearest shard.
  if (skill <= 0) {
    let nearest = null;
    let nearestDistance = Infinity;
    for (const shard of state.shards) {
      const d = Math.hypot(shard.x - player.x, shard.y - player.y);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = shard;
      }
    }
    if (nearest !== null && nearestDistance > 4) {
      moveX = (nearest.x - player.x) / nearestDistance;
      moveY = (nearest.y - player.y) / nearestDistance;
    }
    return { moveX, moveY, aimX: nearest === null ? player.x : nearest.x, aimY: nearest === null ? player.y - 100 : nearest.y, firing: true };
  }

  // Chase the nearest ember or power-up.
  let target = null;
  let targetDistance = Infinity;
  for (const ember of state.embers) {
    const dx = ember.x - player.x;
    const dy = ember.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < targetDistance) {
      targetDistance = d;
      target = { x: ember.x, y: ember.y };
    }
  }
  for (const powerup of state.powerups) {
    const dx = powerup.x - player.x;
    const dy = powerup.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d < targetDistance) {
      targetDistance = d;
      target = { x: powerup.x, y: powerup.y };
    }
  }
  if (target !== null && targetDistance > 4) {
    const weight = 0.9 * skill + 0.1;
    moveX += ((target.x - player.x) / targetDistance) * weight;
    moveY += ((target.y - player.y) / targetDistance) * weight;
  } else {
    moveX += (FIELD.width / 2 - player.x) / FIELD.width;
    moveY += (FIELD.height / 2 - player.y) / FIELD.height;
  }

  // Push away from shards that are closing in.
  const range = 60 + 110 * skill;
  for (const shard of state.shards) {
    const dx = player.x - shard.x;
    const dy = player.y - shard.y;
    const d = Math.hypot(dx, dy);
    if (d < range && d > 1) {
      const push = (1 - d / range) * 2.4;
      moveX += (dx / d) * push;
      moveY += (dy / d) * push;
    }
  }

  // Aim at the nearest shard and fire while one is in range.
  let aim = { x: player.x, y: player.y - 100 };
  let firing = false;
  let nearest = Infinity;
  for (const shard of state.shards) {
    const d = Math.hypot(shard.x - player.x, shard.y - player.y);
    if (d < nearest) {
      nearest = d;
      aim = { x: shard.x, y: shard.y };
    }
  }
  if (nearest < 520) firing = true;

  const length = Math.hypot(moveX, moveY) || 1;
  return { moveX: moveX / length, moveY: moveY / length, aimX: aim.x, aimY: aim.y, firing };
}

/**
 * Set `world` to the named scene (start, play, surge or end; any other name
 * is start) and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'surge' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, autopilot(world.state, 1));
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'surge') {
    // Wait for the storm to actually arrive: wave 5 active, shards on field.
    for (let i = 0; i < SURGE_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 1));
      if (world.state.wave >= 5 && world.state.waveState === 'active' && world.state.shards.length >= 6) break;
      if (world.state.over) break;
    }
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  if (name === 'end') {
    // Play well for a while, then fly into the void: a real game-over
    // screen with a score worth showing.
    for (let i = 0; i < 20 / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 1));
      if (world.state.over) break;
    }
    for (let i = 0; i < END_LIMIT_SECONDS / STEP; i += 1) {
      world.step(STEP, autopilot(world.state, 0));
      if (world.state.over) break;
    }
    return { screen: SCREEN_OVER, best: world.state.score };
  }
  for (let i = 0; i < PLAY_SECONDS / STEP; i += 1) {
    world.step(STEP, autopilot(world.state, 1));
    if (world.state.over) break;
  }
  // If the timer lands on a wave intro, keep going until the fight is on.
  for (let i = 0; i < 12 / STEP; i += 1) {
    if (world.state.over) break;
    if (world.state.waveState === 'active' && world.state.shards.length >= 4) break;
    world.step(STEP, autopilot(world.state, 1));
  }
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
