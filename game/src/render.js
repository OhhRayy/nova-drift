// NOVA DRIFT — the renderer: everything the player sees.
// One file, one job: paint the field, the ships, the HUD and the screens.
// It never changes the world; it only reads state and draws it, scaled to
// whatever window the canvas sits in.

import { EMBER, FIELD, PALETTE, PLAYER, POWERUP, WAVES } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Make a soft glowing disc sprite once, then stamp it cheaply every frame. */
function glowSprite(color, core, radius) {
  const size = radius * 4;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, core);
  gradient.addColorStop(0.35, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let width = 0;
  let height = 0;

  // A fixed starfield, seeded once so every run paints the same sky.
  const starRandom = createRandom(1337);
  const stars = [];
  for (let i = 0; i < 130; i += 1) {
    stars.push({
      x: starRandom() * FIELD.width,
      y: starRandom() * FIELD.height,
      size: 0.6 + starRandom() * 1.7,
      twinkle: starRandom() * Math.PI * 2,
      depth: 0.25 + starRandom() * 0.75,
    });
  }

  const sprites = {
    ember: glowSprite(PALETTE.ember, PALETTE.emberCore, EMBER.radius),
    bullet: glowSprite(PALETTE.bullet, '#ffffff', 6),
    shard: glowSprite(PALETTE.shard, PALETTE.shardCore, 16),
    spinner: glowSprite(PALETTE.spinner, '#ffe1b8', 18),
    weaver: glowSprite(PALETTE.weaver, '#eedcff', 14),
    ship: glowSprite(PALETTE.ship, PALETTE.shipCore, PLAYER.radius + 8),
  };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(1, Math.floor(rect.width * dpr));
    height = Math.max(1, Math.floor(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
  }

  function toWorld(cssX, cssY) {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = cssX * dpr;
    const py = cssY * dpr;
    return { x: (px - offsetX) / scale, y: (py - offsetY) / scale };
  }

  function drawBackground(time) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.spaceTop);
    gradient.addColorStop(1, PALETTE.spaceBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Nebulae drift almost imperceptibly, so the sky feels alive.
    const blobs = [
      { x: 180 + Math.sin(time * 0.05) * 12, y: 130, r: 220, color: PALETTE.nebulaA },
      { x: 780, y: 430 + Math.cos(time * 0.04) * 10, r: 260, color: PALETTE.nebulaB },
      { x: 520, y: 90, r: 170, color: PALETTE.nebulaC },
    ];
    for (const blob of blobs) {
      const radial = ctx.createRadialGradient(blob.x, blob.y, 0, blob.x, blob.y, blob.r);
      radial.addColorStop(0, blob.color);
      radial.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = radial;
      ctx.fillRect(blob.x - blob.r, blob.y - blob.r, blob.r * 2, blob.r * 2);
    }
    for (const star of stars) {
      const alpha = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.9 + star.twinkle));
      ctx.globalAlpha = alpha * star.depth;
      ctx.fillStyle = PALETTE.star;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawShip(state) {
    const player = state.player;
    if (player.invuln > 0 && Math.floor(state.time * 12) % 2 === 0) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle + Math.PI / 2);
    // Engine flame, flickering with time.
    const flame = 12 + Math.sin(state.time * 31) * 4 + Math.sin(state.time * 57) * 2;
    const flameGradient = ctx.createLinearGradient(0, 8, 0, 8 + flame);
    flameGradient.addColorStop(0, 'rgba(255, 200, 90, 0.9)');
    flameGradient.addColorStop(1, 'rgba(255, 90, 60, 0)');
    ctx.fillStyle = flameGradient;
    ctx.beginPath();
    ctx.moveTo(-5, 8);
    ctx.lineTo(0, 8 + flame);
    ctx.lineTo(5, 8);
    ctx.closePath();
    ctx.fill();
    // Hull: a dart with a bright spine.
    ctx.fillStyle = PALETTE.ship;
    ctx.beginPath();
    ctx.moveTo(0, -15);
    ctx.lineTo(10, 10);
    ctx.lineTo(4, 6);
    ctx.lineTo(-4, 6);
    ctx.lineTo(-10, 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.shipCore;
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, 6);
    ctx.lineTo(-4, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Shield ring while the aegis holds.
    if (player.shieldUntil > state.time) {
      ctx.strokeStyle = 'rgba(77, 210, 255, 0.75)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, PLAYER.radius + 9 + Math.sin(state.time * 6) * 1.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawShards(state) {
    for (const shard of state.shards) {
      const sprite = shard.kind === 'spinner' ? sprites.spinner : shard.kind === 'weaver' ? sprites.weaver : sprites.shard;
      const size = shard.radius * 4;
      ctx.drawImage(sprite, shard.x - size / 2, shard.y - size / 2, size, size);
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.angle);
      ctx.strokeStyle = shard.kind === 'weaver' ? PALETTE.weaver : shard.kind === 'spinner' ? PALETTE.spinner : PALETTE.shard;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const points = shard.kind === 'spinner' ? 5 : 6;
      for (let i = 0; i <= points; i += 1) {
        const a = (i / points) * Math.PI * 2;
        const r = i % 2 === 0 ? shard.radius : shard.radius * 0.55;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
      if (shard.hp > 1) {
        ctx.fillStyle = PALETTE.text;
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('×2', 0, 3.5);
      }
      ctx.restore();
    }
  }

  function drawEmbers(state) {
    for (const ember of state.embers) {
      const pulse = 1 + Math.sin(state.time * 5 + ember.phase) * 0.15;
      const size = EMBER.radius * 4 * pulse;
      ctx.drawImage(sprites.ember, ember.x - size / 2, ember.y - size / 2, size, size);
      ctx.fillStyle = PALETTE.emberCore;
      ctx.beginPath();
      ctx.arc(ember.x, ember.y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawPowerups(state) {
    for (const powerup of state.powerups) {
      const tune = POWERUP[powerup.kind];
      const bob = Math.sin(state.time * 4 + powerup.phase) * 3;
      ctx.save();
      ctx.translate(powerup.x, powerup.y + bob);
      ctx.strokeStyle = tune.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = tune.color;
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tune.label, 0, 0.5);
      ctx.restore();
    }
  }

  function drawBullets(state) {
    for (const bullet of state.bullets) {
      ctx.drawImage(sprites.bullet, bullet.x - 12, bullet.y - 12, 24, 24);
    }
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawFloaters(state) {
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const floater of state.floaters) {
      ctx.globalAlpha = Math.max(0, floater.life / floater.maxLife);
      ctx.fillStyle = floater.color;
      ctx.fillText(floater.text, floater.x, floater.y);
    }
    ctx.globalAlpha = 1;
  }

  function bar(x, y, width, height, fraction, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, fraction)), height);
  }

  function drawHud(state, best) {
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('SCORE', 20, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(state.score), 20, 60);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 20, 80);
    // Wave, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText(state.wave % WAVES.stormEveryWave === 0 && state.wave > 0 ? 'STORM SURGE' : 'WAVE', FIELD.width - 20, 30);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(String(Math.max(1, state.wave)), FIELD.width - 20, 60);
    // Combo, top centre.
    if (state.combo >= 2) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.ember;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText(`COMBO ×${state.mult}`, FIELD.width / 2, 52);
      bar(FIELD.width / 2 - 60, 62, 120, 5, state.comboTimer / 6, PALETTE.ember);
    }
    // Lives, bottom left: little ships.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillText('HULL', 20, FIELD.height - 34);
    for (let i = 0; i < state.lives; i += 1) {
      const x = 28 + i * 24;
      const y = FIELD.height - 18;
      ctx.fillStyle = PALETTE.ship;
      ctx.beginPath();
      ctx.moveTo(x, y - 8);
      ctx.lineTo(x + 7, y + 6);
      ctx.lineTo(x - 7, y + 6);
      ctx.closePath();
      ctx.fill();
    }
    // Power-up timers, bottom right.
    const player = state.player;
    const active = [
      { label: 'TRIPLE', until: player.tripleUntil, total: 10, color: '#ffcf4d' },
      { label: 'AEGIS', until: player.shieldUntil, total: 8, color: '#4dd2ff' },
      { label: 'MAGNET', until: player.magnetUntil, total: 10, color: '#c58cff' },
      { label: 'OVERDRIVE', until: player.overUntil, total: 5, color: '#7dffce' },
    ].filter((entry) => entry.until > state.time);
    ctx.textAlign = 'right';
    active.forEach((entry, index) => {
      const y = FIELD.height - 22 - index * 22;
      ctx.fillStyle = entry.color;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(entry.label, FIELD.width - 86, y);
      bar(FIELD.width - 80, y - 9, 60, 7, (entry.until - state.time) / entry.total, entry.color);
    });
    // Wave intro banner.
    if (state.waveState === 'intro' && state.wave > 0) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.min(1, state.waveTimer);
      ctx.fillStyle = PALETTE.text;
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText(`WAVE ${state.wave}`, FIELD.width / 2, FIELD.height / 2 - 20);
      if (state.wave % WAVES.stormEveryWave === 0) {
        ctx.fillStyle = PALETTE.danger;
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.fillText('STORM SURGE — TWICE THE SHARDS', FIELD.width / 2, FIELD.height / 2 + 12);
      }
      ctx.globalAlpha = 1;
    }
    // Low hull warning.
    if (state.lives === 1 && !state.over) {
      ctx.textAlign = 'center';
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(state.time * 6);
      ctx.fillStyle = PALETTE.danger;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText('HULL CRITICAL', FIELD.width / 2, FIELD.height - 22);
      ctx.globalAlpha = 1;
    }
  }

  function panel(width, height) {
    const x = (FIELD.width - width) / 2;
    const y = (FIELD.height - height) / 2;
    ctx.fillStyle = 'rgba(5, 8, 20, 0.72)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(125, 255, 206, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, width, height);
    return { x, y };
  }

  function drawTitle(state, best) {
    panel(620, 380);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.ship;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('NOVA DRIFT', FIELD.width / 2, FIELD.height / 2 - 104);
    ctx.fillStyle = PALETTE.ember;
    ctx.font = '600 17px system-ui, sans-serif';
    ctx.fillText('HARVEST THE EMBERS · OUTFLY THE VOID', FIELD.width / 2, FIELD.height / 2 - 72);
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px system-ui, sans-serif';
    const lines = [
      'WASD or ARROWS — steer the Kestrel',
      'MOUSE — aim · HOLD CLICK or SPACE — fire',
      'Collect embers to raise your combo multiplier',
      'Shards fall in waves. Three hulls. No second chances.',
      'P — pause · M — mute · R — restart',
    ];
    lines.forEach((line, index) => {
      ctx.fillText(line, FIELD.width / 2, FIELD.height / 2 - 30 + index * 24);
    });
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(`BEST ${best}`, FIELD.width / 2, FIELD.height / 2 + 118);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 4);
    ctx.fillStyle = PALETTE.ok;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', FIELD.width / 2, FIELD.height / 2 + 152);
    ctx.globalAlpha = 1;
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(5, 8, 20, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 8);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText('Press P or ESC to keep flying', FIELD.width / 2, FIELD.height / 2 + 26);
  }

  function drawOver(state, best) {
    panel(560, 360);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.danger;
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('SIGNAL LOST', FIELD.width / 2, FIELD.height / 2 - 96);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText('FINAL SCORE', FIELD.width / 2, FIELD.height / 2 - 58);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText(String(state.score), FIELD.width / 2, FIELD.height / 2 - 12);
    const isBest = state.score > 0 && state.score >= best;
    ctx.fillStyle = isBest ? PALETTE.ember : PALETTE.textDim;
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(isBest ? '★ NEW BEST ★' : `BEST ${best}`, FIELD.width / 2, FIELD.height / 2 + 20);
    const accuracy = state.shots > 0 ? Math.round((state.hits / state.shots) * 100) : 0;
    ctx.fillStyle = PALETTE.text;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Wave ${Math.max(1, state.wave)}  ·  ${state.kills} shards broken  ·  ${state.collected} embers  ·  ${accuracy}% shots on target`, FIELD.width / 2, FIELD.height / 2 + 56);
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(state.time * 4);
    ctx.fillStyle = PALETTE.ok;
    ctx.font = 'bold 19px system-ui, sans-serif';
    ctx.fillText('PRESS R OR ENTER TO FLY AGAIN', FIELD.width / 2, FIELD.height / 2 + 104);
    ctx.globalAlpha = 1;
  }

  /** Paint one frame: the field, then the screen on top of it. */
  function draw(state, screen, best, muted) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#04060f';
    ctx.fillRect(0, 0, width, height);
    const shakeX = Math.sin(state.time * 127.1) * state.shake * 10;
    const shakeY = Math.cos(state.time * 149.7) * state.shake * 10;
    ctx.setTransform(scale, 0, 0, scale, offsetX + shakeX * scale, offsetY + shakeY * scale);
    drawBackground(state.time);
    drawEmbers(state);
    drawPowerups(state);
    drawShards(state);
    drawBullets(state);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawShip(state);
    drawParticles(state);
    drawFloaters(state);
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 80, 90, ${state.flash * 0.55})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state, best);
    if (muted) {
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.fillText('MUTED — M TO UNMUTE', 20, FIELD.height - 58);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  resize();
  return { draw, resize, toWorld };
}
