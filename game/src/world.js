// NOVA DRIFT — the world: state, spawning, waves, movement, collisions.
// One file, one job: the whole simulation. It knows nothing about the screen
// or the sound; it steps in fixed 1/60 s slices and reports what happened
// as events, so the renderer and the sound board can answer each one.

import { COMBO, EMBER, FIELD, PLAYER, POWERUP, SHARD, WAVES } from './config.js';
import { angle, pick, range, rangeInt } from './random.js';

export const EVENT_HIT = 'hit';
export const EVENT_OVER = 'over';
export const EVENT_PICKUP = 'pickup';
export const EVENT_KILL = 'kill';
export const EVENT_POWERUP = 'powerup';
export const EVENT_WAVE = 'wave';
export const EVENT_CLEAR = 'clear';

const SHARD_KINDS = ['drifter', 'spinner', 'weaver'];
const POWERUP_KINDS = ['triple', 'shield', 'magnet', 'over'];

/** A fresh, empty state. */
function freshState() {
  return {
    time: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    mult: 1,
    wave: 0,
    lives: PLAYER.lives,
    waveState: 'intro',
    waveTimer: 2,
    spawnTimer: 0,
    emberTimer: 0.5,
    toSpawn: 0,
    spawned: 0,
    destroyed: 0,
    escaped: 0,
    kills: 0,
    collected: 0,
    shots: 0,
    hits: 0,
    over: false,
    shake: 0,
    flash: 0,
    player: {
      x: FIELD.width / 2,
      y: FIELD.height - 90,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      fireCooldown: 0,
      invuln: 0,
      shieldUntil: 0,
      tripleUntil: 0,
      magnetUntil: 0,
      overUntil: 0,
    },
    bullets: [],
    embers: [],
    shards: [],
    particles: [],
    powerups: [],
    floaters: [],
  };
}

export function createWorld(random) {
  const state = freshState();

  function reset() {
    Object.assign(state, freshState());
    startWave(1);
  }

  function waveBudget(wave) {
    const base = WAVES.baseBudget + WAVES.budgetPerWave * (wave - 1);
    return wave % WAVES.stormEveryWave === 0 ? base * 2 : base;
  }

  function startWave(wave) {
    state.wave = wave;
    state.toSpawn = waveBudget(wave);
    state.spawned = 0;
    state.destroyed = 0;
    state.escaped = 0;
    state.spawnTimer = 0.6;
    state.waveState = 'intro';
    state.waveTimer = 2;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = angle(random);
      const v = range(random, speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: range(random, 0.3, 0.7),
        maxLife: 0.7,
        color,
        size: range(random, 2, 4.5),
      });
    }
  }

  function floater(x, y, text, color) {
    state.floaters.push({ x, y, text, color, life: 0.9, maxLife: 0.9 });
  }

  function raiseCombo() {
    state.combo += 1;
    state.comboTimer = COMBO.decaySeconds;
    state.mult = Math.min(1 + Math.floor(state.combo / 4), COMBO.max);
  }

  function spawnEmber() {
    state.embers.push({
      x: range(random, 40, FIELD.width - 40),
      y: range(random, 40, FIELD.height - 140),
      vx: range(random, -EMBER.drift, EMBER.drift),
      vy: range(random, -EMBER.drift, EMBER.drift),
      life: EMBER.lifeSeconds,
      phase: random() * Math.PI * 2,
    });
  }

  function spawnShard() {
    const wave = state.wave;
    let kinds = ['drifter'];
    if (wave >= WAVES.spinnerFromWave) kinds = [...kinds, 'spinner'];
    if (wave >= WAVES.weaverFromWave) kinds = [...kinds, 'weaver'];
    const kind = pick(random, kinds);
    const tune = SHARD[kind];
    const speed = tune.speed * (1 + (wave - 1) * 0.06);
    const shard = {
      kind,
      x: range(random, 30, FIELD.width - 30),
      y: -30,
      vx: 0,
      vy: speed,
      hp: tune.hp,
      radius: tune.radius,
      score: tune.score,
      angle: range(random, 0, Math.PI * 2),
      spin: range(random, -2.4, 2.4),
      phase: random() * Math.PI * 2,
      freq: range(random, 1.2, 2.2),
    };
    if (kind === 'weaver') shard.x = range(random, 80, FIELD.width - 80);
    state.shards.push(shard);
    state.spawned += 1;
  }

  function spawnPowerup(x, y) {
    state.powerups.push({
      kind: pick(random, POWERUP_KINDS),
      x, y,
      vy: 55,
      life: 10,
      phase: random() * Math.PI * 2,
    });
  }

  function fireBullet(angleValue, speedScale = 1) {
    const player = state.player;
    state.bullets.push({
      x: player.x + Math.cos(angleValue) * (PLAYER.radius + 6),
      y: player.y + Math.sin(angleValue) * (PLAYER.radius + 6),
      vx: Math.cos(angleValue) * PLAYER.bulletSpeed * speedScale,
      vy: Math.sin(angleValue) * PLAYER.bulletSpeed * speedScale,
      life: 1.1,
    });
    state.shots += 1;
  }

  function destroyShard(index, events) {
    const shard = state.shards[index];
    state.shards.splice(index, 1);
    state.destroyed += 1;
    state.kills += 1;
    raiseCombo();
    const gained = shard.score * state.mult;
    state.score += gained;
    floater(shard.x, shard.y, `+${gained}`, '#ffe9a8');
    burst(shard.x, shard.y, shard.kind === 'weaver' ? '#c58cff' : shard.kind === 'spinner' ? '#ff9a3d' : '#ff5d7a', 14, 190);
    events.push({ type: EVENT_KILL });
    if (random() < 0.14) spawnPowerup(shard.x, shard.y);
  }

  function hitPlayer(shard, index, events) {
    const player = state.player;
    if (player.shieldUntil > state.time) {
      state.shards.splice(index, 1);
      state.destroyed += 1;
      state.score += 10 * state.mult;
      burst(shard.x, shard.y, '#4dd2ff', 10, 160);
      events.push({ type: EVENT_KILL });
      return;
    }
    state.shards.splice(index, 1);
    state.destroyed += 1;
    state.lives -= 1;
    state.combo = 0;
    state.mult = 1;
    state.comboTimer = 0;
    player.invuln = PLAYER.invulnSeconds;
    state.shake = 1;
    state.flash = 0.4;
    burst(player.x, player.y, '#ff5d7a', 26, 260);
    burst(player.x, player.y, '#ffffff', 10, 140);
    events.push({ type: EVENT_HIT });
    if (state.lives <= 0) {
      state.over = true;
      burst(player.x, player.y, '#7dffce', 40, 320);
      events.push({ type: EVENT_OVER });
    }
  }

  function distance(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Advance the world by dt seconds. `input` is { moveX, moveY, aimX, aimY,
   * firing } in field coordinates. Returns the events of this step.
   */
  function step(dt, input) {
    const events = [];
    if (state.over) {
      updateAmbient(dt);
      return events;
    }
    state.time += dt;
    const player = state.player;
    const overdrive = player.overUntil > state.time;
    const enemyDt = overdrive ? dt * 0.45 : dt;

    // Combo decay.
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.mult = 1;
      }
    }
    player.invuln = Math.max(0, player.invuln - dt);
    state.shake = Math.max(0, state.shake - dt * 2.2);
    state.flash = Math.max(0, state.flash - dt * 1.8);

    // Player movement and aim.
    const length = Math.hypot(input.moveX, input.moveY) || 1;
    player.vx += (input.moveX / length) * PLAYER.accel * dt;
    player.vy += (input.moveY / length) * PLAYER.accel * dt;
    const drag = Math.pow(PLAYER.drag, dt * 60);
    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.maxSpeed) {
      player.vx = (player.vx / speed) * PLAYER.maxSpeed;
      player.vy = (player.vy / speed) * PLAYER.maxSpeed;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

    // Firing.
    player.fireCooldown -= dt;
    if (input.firing && player.fireCooldown <= 0) {
      player.fireCooldown = PLAYER.fireInterval;
      const triple = player.tripleUntil > state.time;
      fireBullet(player.angle);
      if (triple) {
        fireBullet(player.angle - 0.22);
        fireBullet(player.angle + 0.22);
      }
      events.push({ type: 'shot' });
    }

    // Waves.
    if (state.waveState === 'intro') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) {
        state.waveState = 'active';
        events.push({ type: EVENT_WAVE, wave: state.wave });
      }
    } else if (state.waveState === 'active') {
      if (state.spawned < state.toSpawn) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = Math.max(0.35, 0.95 - state.wave * 0.05);
          spawnShard();
        }
      } else if (state.shards.length === 0) {
        const bonus = WAVES.clearBonus * state.wave;
        state.score += bonus;
        floater(FIELD.width / 2, FIELD.height / 2 - 40, `WAVE ${state.wave} CLEAR  +${bonus}`, '#7dffce');
        events.push({ type: EVENT_CLEAR, wave: state.wave });
        state.waveState = 'clear';
        state.waveTimer = 1.6;
      }
    } else if (state.waveState === 'clear') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) startWave(state.wave + 1);
    }

    // Embers.
    state.emberTimer -= dt;
    if (state.emberTimer <= 0) {
      state.emberTimer = EMBER.spawnEvery;
      if (state.embers.length < EMBER.maxOnField) spawnEmber();
    }
    const magnet = player.magnetUntil > state.time;
    for (let i = state.embers.length - 1; i >= 0; i -= 1) {
      const ember = state.embers[i];
      ember.life -= dt;
      if (magnet) {
        const d = distance(ember.x, ember.y, player.x, player.y);
        if (d < 260 && d > 1) {
          ember.vx += ((player.x - ember.x) / d) * 900 * dt;
          ember.vy += ((player.y - ember.y) / d) * 900 * dt;
        }
      }
      ember.x += ember.vx * dt;
      ember.y += ember.vy * dt;
      if (ember.x < 12 || ember.x > FIELD.width - 12) ember.vx *= -1;
      if (ember.y < 12 || ember.y > FIELD.height - 12) ember.vy *= -1;
      ember.x = Math.min(FIELD.width - 10, Math.max(10, ember.x));
      ember.y = Math.min(FIELD.height - 10, Math.max(10, ember.y));
      if (ember.life <= 0) {
        state.embers.splice(i, 1);
        continue;
      }
      if (distance(ember.x, ember.y, player.x, player.y) < PLAYER.radius + EMBER.radius + 4) {
        state.embers.splice(i, 1);
        state.collected += 1;
        raiseCombo();
        const gained = EMBER.value * state.mult;
        state.score += gained;
        floater(ember.x, ember.y, `+${gained}`, '#ffb347');
        burst(ember.x, ember.y, '#ffb347', 8, 120);
        events.push({ type: EVENT_PICKUP, combo: state.combo });
      }
    }

    // Bullets.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        state.bullets.splice(i, 1);
      }
    }

    // Shards.
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const shard = state.shards[i];
      shard.angle += shard.spin * enemyDt;
      if (shard.kind === 'drifter') {
        shard.x += Math.sin(state.time * shard.freq + shard.phase) * 46 * enemyDt;
        shard.y += shard.vy * enemyDt;
      } else if (shard.kind === 'spinner') {
        const d = distance(shard.x, shard.y, player.x, player.y);
        if (d > 1) {
          shard.x += ((player.x - shard.x) / d) * 55 * enemyDt;
          shard.y += ((player.y - shard.y) / d) * 55 * enemyDt + shard.vy * 0.4 * enemyDt;
        }
      } else {
        shard.x += Math.sin(state.time * 3 + shard.phase) * 170 * enemyDt;
        shard.y += shard.vy * enemyDt;
      }
      if (shard.y > FIELD.height + 40 || shard.x < -50 || shard.x > FIELD.width + 50) {
        state.shards.splice(i, 1);
        state.escaped += 1;
        continue;
      }
      if (player.invuln <= 0 && distance(shard.x, shard.y, player.x, player.y) < shard.radius + PLAYER.radius - 2) {
        hitPlayer(shard, i, events);
        if (state.over) return events;
      }
    }

    // Bullet against shard.
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = state.bullets[i];
      let consumed = false;
      for (let j = state.shards.length - 1; j >= 0; j -= 1) {
        const shard = state.shards[j];
        if (distance(bullet.x, bullet.y, shard.x, shard.y) < shard.radius + 5) {
          state.bullets.splice(i, 1);
          consumed = true;
          state.hits += 1;
          shard.hp -= 1;
          burst(bullet.x, bullet.y, '#ffe9a8', 4, 90);
          if (shard.hp <= 0) destroyShard(j, events);
          break;
        }
      }
      if (consumed) continue;
    }

    // Power-ups.
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const powerup = state.powerups[i];
      powerup.y += powerup.vy * dt;
      powerup.life -= dt;
      if (powerup.life <= 0 || powerup.y > FIELD.height + 20) {
        state.powerups.splice(i, 1);
        continue;
      }
      if (distance(powerup.x, powerup.y, player.x, player.y) < PLAYER.radius + 14) {
        const tune = POWERUP[powerup.kind];
        if (powerup.kind === 'triple') player.tripleUntil = state.time + tune.seconds;
        if (powerup.kind === 'shield') player.shieldUntil = state.time + tune.seconds;
        if (powerup.kind === 'magnet') player.magnetUntil = state.time + tune.seconds;
        if (powerup.kind === 'over') player.overUntil = state.time + tune.seconds;
        state.powerups.splice(i, 1);
        raiseCombo();
        floater(powerup.x, powerup.y, `${tune.label === 'T' ? 'TRIPLE SHOT' : tune.label === 'S' ? 'AEGIS SHIELD' : tune.label === 'M' ? 'EMBER MAGNET' : 'OVERDRIVE'}`, tune.color);
        burst(powerup.x, powerup.y, tune.color, 12, 150);
        events.push({ type: EVENT_POWERUP, kind: powerup.kind });
      }
    }

    updateAmbient(dt);
    return events;
  }

  function updateAmbient(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const particle = state.particles[i];
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
      particle.life -= dt;
      if (particle.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.floaters.length - 1; i >= 0; i -= 1) {
      const floaterItem = state.floaters[i];
      floaterItem.y -= 34 * dt;
      floaterItem.life -= dt;
      if (floaterItem.life <= 0) state.floaters.splice(i, 1);
    }
  }

  return { state, reset, step };
}
