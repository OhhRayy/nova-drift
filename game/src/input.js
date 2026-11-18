// NOVA DRIFT — input: keyboard and mouse, read fresh every frame.
// One file, one job: turn raw events into one small state object the world
// reads ({ moveX, moveY, aimX, aimY, firing }) plus edge-triggered actions
// (confirm, pause, mute, restart) the main loop consumes once.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';
export const ACTION_RESTART = 'restart';

/** Attach listeners to the canvas and return the live input state. */
export function createInput(canvas) {
  const keys = new Set();
  let mouseHeld = false;
  const state = {
    moveX: 0,
    moveY: 0,
    aimX: 0,
    aimY: 0,
    firing: false,
    mouseIn: false,
  };
  /** Actions pressed since the last consume(), in order. */
  const queue = [];

  function push(action) {
    if (!queue.includes(action)) queue.push(action);
  }

  function keyOf(event) {
    return event.key.length === 1 ? event.key.toLowerCase() : event.key;
  }

  function onKeyDown(event) {
    const key = keyOf(event);
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(key);
    if (key === 'enter' || key === ' ') push(ACTION_CONFIRM);
    if (key === 'p' || key === 'escape') push(ACTION_PAUSE);
    if (key === 'm') push(ACTION_MUTE);
    if (key === 'r') push(ACTION_RESTART);
  }

  function onKeyUp(event) {
    keys.delete(keyOf(event));
  }

  function onBlur() {
    keys.clear();
    mouseHeld = false;
  }

  function aimFrom(event) {
    const rect = canvas.getBoundingClientRect();
    state.aimX = event.clientX - rect.left;
    state.aimY = event.clientY - rect.top;
    state.mouseIn = true;
  }

  function onMouseMove(event) {
    aimFrom(event);
  }

  function onMouseDown(event) {
    aimFrom(event);
    if (event.button === 0) mouseHeld = true;
  }

  function onMouseUp(event) {
    if (event.button === 0) mouseHeld = false;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    state,
    /** Recompute movement and firing from the keys and button held right now. */
    poll() {
      const left = keys.has('a') || keys.has('arrowleft') ? 1 : 0;
      const right = keys.has('d') || keys.has('arrowright') ? 1 : 0;
      const up = keys.has('w') || keys.has('arrowup') ? 1 : 0;
      const down = keys.has('s') || keys.has('arrowdown') ? 1 : 0;
      state.moveX = right - left;
      state.moveY = down - up;
      state.firing = keys.has(' ') || mouseHeld;
      return state;
    },
    /** Take and clear the actions pressed since the last call. */
    consume() {
      return queue.splice(0, queue.length);
    },
  };
}
