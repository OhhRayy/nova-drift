// NOVA DRIFT — configuration: the playfield, the palette, the tuning numbers.
// One file, one job: every number the rest of the game balances on lives here,
// so tuning the game means editing this file and nothing else.

/** Logical playfield size. The renderer letterboxes it into any window. */
export const FIELD = { width: 960, height: 600 };

/** Fixed simulation step, seconds. */
export const STEP = 1 / 60;

/** Frames of invulnerability after a hit, and the combo window. */
export const PLAYER = {
  radius: 13,
  accel: 1500,
  maxSpeed: 340,
  drag: 0.9,
  fireInterval: 0.16,
  bulletSpeed: 560,
  lives: 3,
  invulnSeconds: 2,
  shieldSeconds: 8,
  tripleSeconds: 10,
  magnetSeconds: 10,
  overdriveSeconds: 5,
};

/** Ember (score pickup) tuning. */
export const EMBER = {
  radius: 9,
  value: 10,
  maxOnField: 7,
  spawnEvery: 1.1,
  lifeSeconds: 14,
  drift: 22,
};

/** Shard (enemy) kinds and their tuning. */
export const SHARD = {
  drifter: { radius: 15, hp: 1, score: 25, speed: 70 },
  spinner: { radius: 17, hp: 2, score: 50, speed: 105 },
  weaver: { radius: 13, hp: 1, score: 75, speed: 150 },
};

/** Power-up kinds: letter shown, colour, duration in seconds. */
export const POWERUP = {
  triple: { label: 'T', color: '#ffcf4d', seconds: PLAYER.tripleSeconds },
  shield: { label: 'S', color: '#4dd2ff', seconds: PLAYER.shieldSeconds },
  magnet: { label: 'M', color: '#c58cff', seconds: PLAYER.magnetSeconds },
  over: { label: 'O', color: '#7dffce', seconds: PLAYER.overdriveSeconds },
};

/** Combo: each ember or kill without taking a hit raises the multiplier. */
export const COMBO = { max: 8, decaySeconds: 6 };

/** Waves: budget grows, and new kinds join at these waves. */
export const WAVES = {
  baseBudget: 6,
  budgetPerWave: 3,
  spinnerFromWave: 2,
  weaverFromWave: 3,
  stormEveryWave: 5,
  clearBonus: 100,
};

/** localStorage key for the best score. */
export const BEST_KEY = 'nova-drift-best';

/** Palette: one deep-space night, one warm ember, one cold void. */
export const PALETTE = {
  spaceTop: '#070b1d',
  spaceBottom: '#120a24',
  nebulaA: 'rgba(88, 60, 180, 0.20)',
  nebulaB: 'rgba(16, 120, 140, 0.16)',
  nebulaC: 'rgba(200, 80, 60, 0.10)',
  star: '#dfe8ff',
  ember: '#ffb347',
  emberCore: '#fff3c4',
  ship: '#7dffce',
  shipCore: '#eafff6',
  bullet: '#ffe9a8',
  shard: '#ff5d7a',
  shardCore: '#ffd3dc',
  spinner: '#ff9a3d',
  weaver: '#c58cff',
  text: '#eaf2ff',
  textDim: '#9fb2d8',
  danger: '#ff5d7a',
  ok: '#7dffce',
};
