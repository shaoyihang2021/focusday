import type { NoiseType } from "../types";

/**
 * Ambient noise synthesised with the Web Audio API, so no audio assets ship
 * with the app. Buffers are generated once and looped seamlessly.
 *
 * Graph: source -> source gain -> high pass -> low shelf -> low pass -> master.
 * The three filter stages form a small equaliser and also shape the presets:
 * the high pass trims rumble, the shelf controls low-end thickness and the low
 * pass controls overall brightness.
 *
 * `rain` and `cafe` are procedurally shaped noise, not recordings.
 */

const BUFFER_SECONDS = 3;
const FADE_SECONDS = 0.35;
const TONE_MIN_HZ = 200;
const TONE_MAX_HZ = 16_000;

/** High-pass cutoff per preset: removes rumble where it does not belong. */
const HIGH_PASS_HZ: Record<Exclude<NoiseType, "off">, number> = {
  white: 30,
  pink: 30,
  brown: 25,
  rain: 420,
  cafe: 60,
};

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
let highPass: BiquadFilterNode | null = null;
let lowShelf: BiquadFilterNode | null = null;
let lowPass: BiquadFilterNode | null = null;
let current: Channel | null = null;

function ensureGraph(): AudioContext | null {
  if (ctx && master && highPass && lowShelf && lowPass) return ctx;
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

    highPass = ctx.createBiquadFilter();
    highPass.type = "highpass";
    highPass.Q.value = 0.7;

    lowShelf = ctx.createBiquadFilter();
    lowShelf.type = "lowshelf";
    lowShelf.frequency.value = 200;

    highPass.connect(lowShelf);
    lowShelf.connect(lowPass);
    lowPass.connect(master);
    master.connect(ctx.destination);
    return ctx;
  } catch (err) {
    console.warn("[focusday] noise unavailable", err);
    return null;
  }
}

/** Generates one loopable buffer for the requested preset. */
function buildBuffer(context: AudioContext, type: NoiseType): AudioBuffer {
  // Longer loops for the presets with sparse events, so the repeat is less
  // noticeable than a 3 second cycle would be.
  const seconds = type === "rain" || type === "cafe" ? 8 : BUFFER_SECONDS;
  const length = Math.floor(context.sampleRate * seconds);
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
  } else if (type === "brown") {
    // Brown noise: integrate white noise and leak slightly to avoid drift.
    let last = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  } else if (type === "rain") {
    // Softened hiss plus sparse decaying bursts for individual droplets.
    let low = 0;
    let drop = 0;
    let dropAmp = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      low += 0.45 * (white - low);
      let value = low * 0.85;
      if (drop <= 0 && Math.random() < 1 / 2000) {
        drop = 200;
        dropAmp = 0.25 + Math.random() * 0.5;
      }
      if (drop > 0) {
        value += (Math.random() * 2 - 1) * dropAmp * (drop / 200);
        drop -= 1;
      }
      data[i] = value;
    }
  } else {
    // cafe: a low murmur (heavily filtered noise) with light broadband chatter.
    let murmur = 0;
    for (let i = 0; i < length; i += 1) {
      const white = Math.random() * 2 - 1;
      murmur += 0.06 * (white - murmur);
      const chatter = white - murmur;
      data[i] = murmur * 1.8 + chatter * 0.18;
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

function start(type: Exclude<NoiseType, "off">): void {
  const context = ensureGraph();
  if (!context || !highPass) return;

  highPass.frequency.value = HIGH_PASS_HZ[type];

  const gain = context.createGain();
  gain.gain.value = 0;
  gain.connect(highPass);

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
  if (!playing || type === "off") {
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
