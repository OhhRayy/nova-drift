// NOVA DRIFT — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast
// one), and the renderer paints what is there. The game moves between four
// screens: title, play, paused and game over.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|surge|end (with
// &seed=N) stages that scene instead of running the loop, paints it twice
// and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, createInput } from './input.js';
import { createWorld, EVENT_CLEAR, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_POWERUP, EVENT_WAVE } from './world.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let aimWorld = { x: world.state.player.x, y: world.state.player.y - 120 };

  window.addEventListener('resize', () => renderer.resize());

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Three hulls. Harvest the embers.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}.`);
  }

  function handleEvents(events) {
    for (const event of events) {
      if (event.type === EVENT_PICKUP) audio.pickup(event.combo);
      else if (event.type === EVENT_KILL) audio.kill();
      else if (event.type === EVENT_HIT) audio.hit();
      else if (event.type === EVENT_POWERUP) audio.powerup();
      else if (event.type === EVENT_WAVE) audio.wave();
      else if (event.type === EVENT_CLEAR) audio.wave();
      else if (event.type === EVENT_OVER) {
        audio.over();
        endGame();
      }
    }
  }

  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    const polled = input.poll();
    for (const action of input.consume()) {
      if (action === ACTION_MUTE) {
        const muted = audio.toggleMute();
        announce(muted ? 'Muted.' : 'Sound on.');
      } else if (action === ACTION_PAUSE) {
        if (screen === SCREEN_PLAY) {
          screen = SCREEN_PAUSED;
          announce('Paused.');
        } else if (screen === SCREEN_PAUSED) {
          screen = SCREEN_PLAY;
          announce('Playing.');
        }
      } else if (action === ACTION_CONFIRM) {
        audio.unlock();
        if (screen === SCREEN_TITLE) startGame();
        else if (screen === SCREEN_OVER) startGame();
        else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
      } else if (action === ACTION_RESTART) {
        if (screen === SCREEN_OVER || screen === SCREEN_PLAY) startGame();
      }
    }

    if (screen === SCREEN_PLAY) {
      if (polled.mouseIn) {
        aimWorld = renderer.toWorld(polled.aimX, polled.aimY);
      } else {
        aimWorld = {
          x: world.state.player.x + Math.cos(world.state.player.angle) * 120,
          y: world.state.player.y + Math.sin(world.state.player.angle) * 120,
        };
      }
      accumulator += elapsed;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        handleEvents(world.step(STEP, {
          moveX: polled.moveX,
          moveY: polled.moveY,
          aimX: aimWorld.x,
          aimY: aimWorld.y,
          firing: polled.firing,
        }));
        if (screen !== SCREEN_PLAY) break;
      }
    }

    renderer.draw(world.state, screen, best, audio.muted);
    requestAnimationFrame(frame);
  }

  announce('NOVA DRIFT. Press Enter or click to launch.');
  requestAnimationFrame(frame);
}

if (shot !== null) runShot(shot);
else runGame();
