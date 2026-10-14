import type { NoiseType } from "../types";

/**
 * Ambient noise synthesised with the Web Audio API, so no audio assets ship
 * with the app. A short buffer is generated once and looped seamlessly.
 *
 * Graph: source -> source gain -> low shelf -> low pass -> master -> output.
 * The two filter stages form a small equaliser: the shelf controls how thick
 * the low end is, the low pass controls overall brightness.
 */

const BUFFER_SECONDS = 3;
const FADE_SECONDS = 0.35;
const TONE_MIN_HZ = 200;
const TONE_MAX_HZ = 16_000;

/** Maps the 0–1 tone setting onto a logarithmic frequency sweep. */
const toneToHz = (tone: number): number =>
  TONE_MIN_HZ * (TONE_MAX_HZ / TONE_MIN_HZ) ** Math.min(1, Math.max(0, tone));

interface Channel {
  node: AudioBufferSourceNode;
  gain: GainNode;
  type: NoiseType;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let lowShelf: BiquadFilterNode | null = null;
let lowPass: BiquadFilterNode | null = null;
let current: Channel | null = null;

function ensureGraph(): AudioContext | null {
  if (ctx && master && lowShelf && lowPass) return ctx;
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();

    master = ctx.createGain();
    master.gain.value = 0;

    lowPass = ctx.createBiquadFilter();
    lowPass.type = "lowpass";
    lowPass.Q.value = 0.7;

    lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 200;

    lowShelf.connect(lowPass);
    lowPass.connect(master);
    master.connect(ctx.destination);
    return ctx;
  } catch (err) {
    console.warn("[focusday] noise unavailable", err);
    return null;
  }
}

/** Generates one loopable buffer of the requested noise colour. */
function buildBuffer(context: AudioContext, type: NoiseType): AudioBuffer {
  const length = Math.floor(context.sampleRate * BUFFER_SECONDS);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = new Float32Array(length);

  if (type === "white") {
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  } else if (type === "pink") {
    // Paul Kellet's refined pink-noise filter.
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    // Brown noise: integrate white noise and leak slightly to avoid drift.
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }

  buffer.copyToChannel(data, 0);
  return buffer;
}

/** Fades a channel out and releases it, so stop/switch never clicks. */
function release(channel: Channel, immediate = false): void {
  const context = ctx;
  const { node, gain } = channel;
  const now = context?.currentTime ?? 0;

  if (!context || immediate) {
    try {
      node.stop();
    } catch {
      /* already stopped */
    }
    node.disconnect();
    gain.disconnect();
    return;
  }

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + FADE_SECONDS);
  window.setTimeout(
    () => {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
      node.disconnect();
      gain.disconnect();
    },
    FADE_SECONDS * 1000 + 60,
  );
}

function start(type: NoiseType): void {
  const context = ensureGraph();
  if (!context || !lowShelf) return;

  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(lowShelf);

  const node = context.createBufferSource();
  node.buffer = buildBuffer(context, type);
  node.loop = true;
  node.connect(gain);
  node.start();

  const now = context.currentTime;
  gain.gain.linearRampToValueAtTime(1, now + FADE_SECONDS);

  current = { node, gain, type };
}

/**
 * Declarative entry point: call with the desired state whenever the timer or
 * the noise settings change. Handles starting, stopping, switching colour,
 * volume and equaliser updates so the UI never has to.
 */
export function syncNoise(
  playing: boolean,
  type: NoiseType,
  volume: number,
  tone = 0.72,
  bass = 0,
): void {
  const shouldPlay = playing && type !== "off";

  if (!shouldPlay) {
    if (current) {
      release(current);
      current = null;
    }
    return;
  }

  const context = ensureGraph();
  if (!context || !master || !lowPass || !lowShelf) return;
  if (context.state === "suspended") void context.resume();

  const now = context.currentTime;
  master.gain.setTargetAtTime(Math.min(1, Math.max(0, volume)), now, 0.05);
  lowPass.frequency.setTargetAtTime(toneToHz(tone), now, 0.05);
  lowShelf.gain.setTargetAtTime(Math.min(12, Math.max(-12, bass)), now, 0.05);

  if (!current || current.type !== type) {
    // Switch colours: fade the old one out while the new one fades in.
    if (current) release(current);
    start(type);
  }
}
