// NOVA DRIFT — sound: every effect is synthesised with WebAudio, no audio files.
// One file, one job: a small synth that turns game events into bleeps, chimes
// and thuds, with one master mute. Nothing here touches the DOM except sound.

/** Create the sound board. Call unlock() from a user gesture before playing. */
export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let lastShoot = 0;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.35;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  /** Resume the context after a click or keypress (browsers block sound before one). */
  function unlock() {
    if (!ensure()) return;
    if (context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone({ frequency, end, duration, type, volume, when = 0 }) {
    if (muted || !ensure() || context.state !== 'running') return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (end !== undefined) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise({ duration, volume, lowpass }) {
    if (muted || !ensure() || context.state !== 'running') return;
    const start = context.currentTime;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    shoot() {
      const now = performance.now();
      if (now - lastShoot < 70) return;
      lastShoot = now;
      tone({ frequency: 880, end: 320, duration: 0.09, type: 'square', volume: 0.12 });
    },
    pickup(combo) {
      const base = 520 * Math.pow(1.059, Math.min(combo, 12));
      tone({ frequency: base, duration: 0.1, type: 'sine', volume: 0.22 });
      tone({ frequency: base * 1.5, duration: 0.14, type: 'sine', volume: 0.18, when: 0.06 });
    },
    kill() {
      noise({ duration: 0.16, volume: 0.25, lowpass: 2400 });
      tone({ frequency: 220, end: 55, duration: 0.18, type: 'triangle', volume: 0.25 });
    },
    hit() {
      noise({ duration: 0.35, volume: 0.4, lowpass: 900 });
      tone({ frequency: 140, end: 38, duration: 0.4, type: 'sawtooth', volume: 0.3 });
    },
    powerup() {
      [523, 659, 784, 1046].forEach((frequency, index) => {
        tone({ frequency, duration: 0.12, type: 'triangle', volume: 0.2, when: index * 0.07 });
      });
    },
    wave() {
      tone({ frequency: 392, duration: 0.16, type: 'sine', volume: 0.2 });
      tone({ frequency: 587, duration: 0.22, type: 'sine', volume: 0.2, when: 0.1 });
    },
    over() {
      [392, 330, 262, 196].forEach((frequency, index) => {
        tone({ frequency, duration: 0.28, type: 'triangle', volume: 0.22, when: index * 0.16 });
      });
    },
  };
}
