import { MidiNote } from '../types';

// Simple oscillator synth
const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;

export const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

export const playTone = (freq: number, duration: number = 0.3, type: OscillatorType = 'sine') => {
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + duration);
};

// --- Pitch Detection (Autocorrelation) ---
export const getPitch = (buf: Float32Array, sampleRate: number): number => {
  const size = buf.length;
  let rms = 0;

  for (let i = 0; i < size; i++) {
    const val = buf[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / size);

  if (rms < 0.01) return -1; // Signal too low

  // Auto-correlate
  let r1 = 0, r2 = size - 1, thres = 0.2;
  for (let i = 0; i < size / 2; i++)
    if (Math.abs(buf[i]) < thres) { r1 = i; break; }
  for (let i = 1; i < size / 2; i++)
    if (Math.abs(buf[size - i]) < thres) { r2 = size - i; break; }

  const bufSlice = buf.slice(r1, r2);
  const cSize = bufSlice.length;
  const c = new Array(cSize).fill(0);
  
  for (let i = 0; i < cSize; i++)
    for (let j = 0; j < cSize - i; j++)
      c[i] = c[i] + bufSlice[j] * bufSlice[j + i];

  let d = 0; while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < cSize; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }
  let T0 = maxpos;

  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
};

// --- MIDI Generation Helpers (Legacy/Optional) ---
const writeString = (view: DataView, offset: number, string: string) => {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
};

const writeVarInt = (data: number[]) => (value: number) => {
  let buffer = value & 0x7f;
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= 0x80;
    buffer += value & 0x7f;
  }
  while (true) {
    data.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
};

export const generateMidiFile = (notes: MidiNote[], bpm: number = 120): Blob => {
  const TICKS_PER_BEAT = 480;
  const secondsPerTick = (60 / bpm) / TICKS_PER_BEAT;

  interface MidiEvent {
    type: 'noteOn' | 'noteOff';
    note: number;
    velocity: number;
    time: number;
  }

  const events: MidiEvent[] = [];

  notes.forEach(n => {
    const startTick = Math.round(n.startTime / secondsPerTick);
    const endTick = Math.round((n.startTime + n.duration) / secondsPerTick);
    events.push({ type: 'noteOn', note: n.note, velocity: n.velocity, time: startTick });
    events.push({ type: 'noteOff', note: n.note, velocity: 0, time: endTick });
  });

  events.sort((a, b) => a.time - b.time);

  const trackData: number[] = [];
  const writeVar = writeVarInt(trackData);

  let currentTime = 0;

  events.forEach(event => {
    const deltaTime = event.time - currentTime;
    currentTime = event.time;
    writeVar(deltaTime);
    if (event.type === 'noteOn') {
      trackData.push(0x90, event.note, event.velocity);
    } else {
      trackData.push(0x80, event.note, 0);
    }
  });

  writeVar(0);
  trackData.push(0xFF, 0x2F, 0x00);

  const headerSize = 14;
  const trackHeaderSize = 8;
  const totalSize = headerSize + trackHeaderSize + trackData.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  writeString(view, 0, 'MThd');
  view.setUint32(4, 6);
  view.setUint16(8, 0);
  view.setUint16(10, 1);
  view.setUint16(12, TICKS_PER_BEAT);

  writeString(view, 14, 'MTrk');
  view.setUint32(18, trackData.length);

  const bytes = new Uint8Array(buffer);
  for(let i=0; i<trackData.length; i++) {
    bytes[22 + i] = trackData[i];
  }

  return new Blob([buffer], { type: 'audio/midi' });
};

export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve((reader.result as string).split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};