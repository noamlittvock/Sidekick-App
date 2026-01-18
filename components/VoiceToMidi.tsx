import React, { useState, useRef } from 'react';
import { Mic, Square, Download, Music, Drum, Loader2 } from 'lucide-react';
import { RecorderState, MidiSketch } from '../types';
import { audioToMidiData } from '../services/geminiService';
import { blobToBase64, generateMidiFile } from '../services/audioService';

const VoiceToMidi: React.FC = () => {
  const [state, setState] = useState<RecorderState>(RecorderState.IDLE);
  const [mode, setMode] = useState<'melody' | 'rhythm'>('melody');
  const [midiSketches, setMidiSketches] = useState<MidiSketch[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/wav' });
        chunksRef.current = [];
        
        setState(RecorderState.ANALYZING);
        try {
          const base64 = await blobToBase64(blob);
          const result = await audioToMidiData(base64, mode);
          
          if (result.notes) {
            const newMidiSketch: MidiSketch = {
              id: Date.now().toString(),
              timestamp: Date.now(),
              durationSec: result.notes.length > 0 ? result.notes[result.notes.length - 1].startTime + 2 : 5,
              audioBlob: blob,
              bpm: result.bpm,
              midiNotes: result.notes,
              mode: mode
            };
            setMidiSketches(prev => [newMidiSketch, ...prev]);
          } else {
            alert("Could not detect notes. Try clearer audio.");
          }
        } catch (err) {
          console.error(err);
        } finally {
          setState(RecorderState.IDLE);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setState(RecorderState.RECORDING);
    } catch (err) {
      console.error(err);
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && state === RecorderState.RECORDING) {
      mediaRecorderRef.current.stop();
    }
  };

  const downloadMidi = (sketch: MidiSketch) => {
    const midiBlob = generateMidiFile(sketch.midiNotes, sketch.bpm || 120);
    const url = URL.createObjectURL(midiBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sidekick_${sketch.mode}_${sketch.id}.mid`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full pb-24">
      {/* Mode Toggle */}
      <div className="flex bg-studio-900 p-1 rounded-xl mb-6">
        <button
          onClick={() => setMode('melody')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${mode === 'melody' ? 'bg-studio-accent text-studio-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          <Music size={18} /> Melody
        </button>
        <button
          onClick={() => setMode('rhythm')}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-bold transition-all ${mode === 'rhythm' ? 'bg-studio-accent text-studio-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
        >
          <Drum size={18} /> Rhythm
        </button>
      </div>

      {/* Recorder */}
      <div className="flex-none bg-gradient-to-br from-studio-800 to-studio-900 p-8 rounded-2xl shadow-lg border border-studio-800 mb-8 text-center relative overflow-hidden">
         {state === RecorderState.ANALYZING && (
           <div className="absolute inset-0 bg-studio-900/90 flex flex-col items-center justify-center z-10">
              <Loader2 className="animate-spin text-studio-accent mb-2" size={40} />
              <span className="text-white font-medium">Generating MIDI...</span>
           </div>
         )}
         
         <div className="mb-6 text-slate-300">
           {mode === 'melody' ? "Hum or sing a melody..." : "Beatbox a rhythm..."}
         </div>

         <div className="flex justify-center">
          {state === RecorderState.IDLE || state === RecorderState.COMPLETED ? (
            <button
              onClick={startRecording}
              className="w-24 h-24 rounded-full bg-indigo-600 shadow-[0_0_20px_rgba(79,70,229,0.4)] flex items-center justify-center hover:scale-105 transition-transform"
            >
              <Mic size={40} className="text-white" />
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="w-24 h-24 rounded-full bg-slate-700 border-4 border-indigo-500 flex items-center justify-center animate-pulse"
            >
              <Square size={32} className="text-white" />
            </button>
          )}
        </div>
      </div>

      {/* MIDI List */}
      <div className="flex-1 overflow-y-auto no-scrollbar space-y-4">
        <h3 className="text-slate-500 font-bold uppercase text-xs tracking-wider mb-2">MIDI Exports</h3>
        {midiSketches.length === 0 && (
          <div className="text-center text-slate-600 py-10 italic">
            No conversions yet.
          </div>
        )}

        {midiSketches.map(sketch => (
          <div key={sketch.id} className="bg-slate-900/50 border border-indigo-900/30 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${sketch.mode === 'melody' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {sketch.mode === 'melody' ? <Music size={18} /> : <Drum size={18} />}
              </div>
              <div>
                <div className="text-white font-medium capitalize">
                  {sketch.mode} to MIDI
                </div>
                <div className="text-xs text-slate-400 mt-1">
                   {sketch.midiNotes.length} notes detected • {sketch.bpm || 120} BPM
                </div>
              </div>
            </div>
            
            <button 
              onClick={() => downloadMidi(sketch)}
              className="px-4 py-2 bg-studio-800 hover:bg-studio-700 text-white text-xs font-bold rounded-lg flex items-center gap-2 border border-slate-700"
            >
              <Download size={14} /> EXPORT
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceToMidi;
