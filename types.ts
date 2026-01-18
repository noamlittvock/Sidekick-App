export enum AppTab {
  TOOLS = 'TOOLS'
}

export interface MidiNote {
  note: number; // MIDI note number (0-127)
  velocity: number; // 0-127
  startTime: number; // in seconds relative to start
  duration: number; // in seconds
}

export interface AnalysisResult {
  bpm?: number;
  key?: string;
  notes?: MidiNote[];
}

export enum RecorderState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED'
}

export interface Sketch {
  id: string;
  timestamp: number;
  durationSec: number;
  audioBlob: Blob;
  bpm?: number;
  key?: string;
}

export interface MidiSketch {
  id: string;
  timestamp: number;
  durationSec: number;
  audioBlob: Blob;
  bpm?: number;
  midiNotes: MidiNote[];
  mode: 'melody' | 'rhythm';
}