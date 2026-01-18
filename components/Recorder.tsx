import React, { useState, useRef } from 'react';
import { Mic, Square, Play, Trash2, Wand2, Loader2, Save } from 'lucide-react';
import { RecorderState, Sketch } from '../types';
import { analyzeAudioClip, audioToMidiData } from '../services/geminiService';
import { blobToBase64 } from '../services/audioService';

const Recorder: React.FC = () => {
  const [state, setState] = useState<RecorderState>(RecorderState.IDLE);
  const [sketches, setSketches] = useState<Sketch[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        const duration = recordingTime;
        chunksRef.current = [];
        
        // Auto analyze immediately
        setState(RecorderState.ANALYZING);
        try {
          const base64 = await blobToBase64(blob);
          const analysis = await analyzeAudioClip(base64);
          
          const newSketch: Sketch = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            durationSec: duration,
            audioBlob: blob,
            bpm: analysis.bpm,
            key: analysis.key
          };
          
          setSketches(prev => [newSketch, ...prev]);
        } catch (err) {
          console.error(err);
        } finally {
          setState(RecorderState.IDLE);
          setRecordingTime(0);
        }
        
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState(RecorderState.RECORDING);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === RecorderState.RECORDING) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const playSketch = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
  };

  const deleteSketch = (id: string) => {
    setSketches(prev => prev.filter(s => s.id !== id));
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full pb-24">
      {/* Active Recorder Area */}
      <div className="flex-none bg-studio-800 p-8 rounded-2xl shadow-lg border border-studio-900 mb-6 text-center relative overflow-hidden">
        {state === RecorderState.ANALYZING && (
           <div className="absolute inset-0 bg-studio-900/80 flex items-center justify-center z-10 backdrop-blur-sm">
             <div className="text-studio-accent animate-pulse flex flex-col items-center">
               <Loader2 className="animate-spin mb-2" size={32} />
               <span>Analyzing Audio...</span>
             </div>
           </div>
        )}

        <div className="text-5xl font-mono text-white mb-8 tracking-widest">
          {formatTime(recordingTime)}
        </div>

        <div className="flex justify-center">
          {state === RecorderState.IDLE || state === RecorderState.COMPLETED ? (
            <button
              onClick={startRecording}
              className="w-24 h-24 rounded-full bg-studio-danger shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center hover:scale-105 transition-transform"
            >
              <Mic size={40} className="text-white" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-24 h-24 rounded-full bg-slate-700 border-4 border-studio-danger flex items-center justify-center animate-pulse"
            >
              <Square size={32} className="text-white" />
            </button>
          )}
        </div>
        
        <p className="mt-4 text-slate-400 text-sm">
          {state === RecorderState.RECORDING ? "Recording..." : "Tap to capture idea"}
        </p>
      </div>

      {/* Sketch List */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
        <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider mb-2">Recent Sketches</h3>
        {sketches.length === 0 && (
          <div className="text-center text-slate-600 py-10 italic">
            No sketches yet. Hit record!
          </div>
        )}
        
        {sketches.map(sketch => (
          <div key={sketch.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => playSketch(sketch.audioBlob)}
                className="w-10 h-10 rounded-full bg-studio-accent/20 text-studio-accent flex items-center justify-center hover:bg-studio-accent hover:text-studio-900 transition-colors"
              >
                <Play size={18} fill="currentColor" />
              </button>
              <div>
                <div className="text-white font-medium">
                  {new Date(sketch.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
                <div className="text-xs text-slate-400 flex gap-2 mt-1">
                   <span className="bg-slate-800 px-2 py-0.5 rounded text-studio-accentGlow">{sketch.bpm || '--'} BPM</span>
                   <span className="bg-slate-800 px-2 py-0.5 rounded text-purple-400">{sketch.key || '--'}</span>
                   <span>{formatTime(sketch.durationSec)}</span>
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => deleteSketch(sketch.id)}
              className="p-2 text-slate-600 hover:text-red-400 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Recorder;
