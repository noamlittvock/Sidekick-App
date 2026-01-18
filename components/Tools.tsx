import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, ArrowRightLeft, Mic, MicOff, Activity } from 'lucide-react';
import { getAudioContext, getPitch } from '../services/audioService';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = [0, 1, 2, 3, 4, 5, 6, 7, 8];

// Tuner Helpers
const noteFromPitch = (frequency: number) => {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  return Math.round(noteNum) + 69;
};

const frequencyFromNoteNumber = (note: number) => {
  return 440 * Math.pow(2, (note - 69) / 12);
};

const centsOffFromPitch = (frequency: number, note: number) => {
  return Math.floor(1200 * Math.log(frequency / frequencyFromNoteNumber(note)) / Math.log(2));
};

const Tools: React.FC = () => {
  // --- Tap Tempo State ---
  const [taps, setTaps] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number>(0);

  // --- Converter State ---
  // BPM <-> MS
  const [bpmVal, setBpmVal] = useState<string>('120');
  const [msVal, setMsVal] = useState<string>('500');

  // Hz <-> Note
  const [isHzToNote, setIsHzToNote] = useState(true);
  const [hzInput, setHzInput] = useState<string>('440');
  const [noteOutput, setNoteOutput] = useState<string>('A4');
  
  // Note -> Hz State (Dropdowns)
  const [selectedNote, setSelectedNote] = useState<string>('A');
  const [selectedOctave, setSelectedOctave] = useState<string>('4');
  const [hzOutput, setHzOutput] = useState<string>('440.00');

  // --- Tuner State ---
  const [isTunerActive, setIsTunerActive] = useState(false);
  const [pitch, setPitch] = useState<{ note: string; cents: number; freq: number } | null>(null);
  const requestRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // --- Tap Tempo Logic ---
  const handleTap = () => {
    const now = Date.now();
    const newTaps = [...taps, now].filter(t => now - t < 3000); 
    setTaps(newTaps);

    if (newTaps.length > 1) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const newBpm = Math.round(60000 / avgInterval);
      setBpm(newBpm);
    }
  };

  const resetTap = () => {
    setTaps([]);
    setBpm(0);
  };

  // --- BPM <-> MS Logic (Bidirectional) ---
  const handleBpmChange = (val: string) => {
    setBpmVal(val);
    const b = parseFloat(val);
    if (!isNaN(b) && b > 0) {
      setMsVal((60000 / b).toFixed(1));
    } else {
      setMsVal('');
    }
  };

  const handleMsChange = (val: string) => {
    setMsVal(val);
    const m = parseFloat(val);
    if (!isNaN(m) && m > 0) {
      setBpmVal((60000 / m).toFixed(1));
    } else {
      setBpmVal('');
    }
  };

  // --- Hz -> Note Logic ---
  useEffect(() => {
    if (!isHzToNote) return;
    const hz = parseFloat(hzInput);
    if (!isNaN(hz) && hz > 0) {
      const noteNum = noteFromPitch(hz);
      const noteName = NOTES[noteNum % 12];
      const oct = Math.floor(noteNum / 12) - 1;
      const cents = centsOffFromPitch(hz, noteNum);
      const centStr = cents === 0 ? '' : cents > 0 ? `+${cents}` : `${cents}`;
      setNoteOutput(`${noteName}${oct} ${centStr}`);
    } else {
      setNoteOutput('...');
    }
  }, [hzInput, isHzToNote]);

  // --- Note -> Hz Logic ---
  useEffect(() => {
    if (isHzToNote) return;
    
    const noteIdx = NOTES.indexOf(selectedNote);
    const oct = parseInt(selectedOctave);
    
    if (noteIdx !== -1 && !isNaN(oct)) {
      const midi = (oct + 1) * 12 + noteIdx;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      setHzOutput(freq.toFixed(2));
    } else {
      setHzOutput('Invalid');
    }
  }, [selectedNote, selectedOctave, isHzToNote]);


  // --- Tuner Logic ---
  const updatePitch = () => {
    if (!analyserRef.current) return;
    const buffer = new Float32Array(2048);
    analyserRef.current.getFloatTimeDomainData(buffer);
    const ac = getPitch(buffer, getAudioContext().sampleRate);

    if (ac > -1) {
      const noteNum = noteFromPitch(ac);
      const noteName = NOTES[noteNum % 12];
      const cents = centsOffFromPitch(ac, noteNum);
      setPitch({
        note: `${noteName}${Math.floor(noteNum / 12) - 1}`,
        cents: cents,
        freq: ac
      });
    }
    requestRef.current = requestAnimationFrame(updatePitch);
  };

  const toggleTuner = async () => {
    if (isTunerActive) {
      setIsTunerActive(false);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      setPitch(null);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = getAudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyserRef.current = analyser;
      setIsTunerActive(true);
      updatePitch();
    } catch (e) {
      console.error(e);
      alert("Microphone access is required for the tuner.");
    }
  };

  return (
    <div className="space-y-6">
      
      {/* --- Section 1: Tap Tempo --- */}
      <section className="bg-app-card rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-white/5">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-white text-lg font-bold">Tempo Monitor</h2>
            <p className="text-app-subtext text-sm mt-1">Tap along to the beat</p>
          </div>
          <button onClick={resetTap} className="p-2 bg-app-surface rounded-full text-app-subtext hover:text-white transition-colors border border-white/5">
            <RotateCcw size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center justify-center mb-8">
           <div className="text-6xl font-bold text-white tracking-tight tabular-nums">
             {bpm > 0 ? bpm : '--'}
           </div>
           <span className="text-sm font-medium text-app-accent mt-2 uppercase tracking-wider">BPM Average</span>
        </div>

        <button 
          onClick={handleTap}
          className="w-full bg-app-text hover:bg-slate-200 active:scale-[0.98] transition-all text-black font-bold py-4 rounded-2xl text-lg"
        >
          TAP
        </button>
      </section>

      {/* --- Section 2: Converters --- */}
      <section className="grid grid-cols-1 gap-4">
        
        {/* BPM <-> MS (Bidirectional) */}
        <div className="bg-app-card rounded-3xl p-6 border border-white/5">
           <div className="flex items-center gap-3 mb-5">
             <div className="w-8 h-8 rounded-full bg-app-surface flex items-center justify-center text-app-subtext">
               <Activity size={16} />
             </div>
             <h3 className="font-bold text-white">Delay Calculator</h3>
           </div>
           
           <div className="flex items-center gap-3">
             <div className="flex-1 bg-app-surface rounded-2xl p-3 border border-white/5 focus-within:border-app-accent/50 transition-colors relative">
               <label className="text-[10px] text-app-subtext uppercase font-bold tracking-wider block mb-1">Tempo</label>
               <div className="flex items-baseline">
                 <input 
                   type="number" 
                   value={bpmVal}
                   onChange={(e) => handleBpmChange(e.target.value)}
                   className="w-full bg-transparent text-white font-mono font-bold text-xl outline-none"
                   placeholder="120"
                 />
                 <span className="text-xs text-app-subtext ml-1">BPM</span>
               </div>
             </div>
             
             <div className="text-app-subtext opacity-50">
               <ArrowRightLeft size={16} />
             </div>

             <div className="flex-1 bg-app-surface rounded-2xl p-3 border border-white/5 focus-within:border-app-accent/50 transition-colors relative">
               <label className="text-[10px] text-app-subtext uppercase font-bold tracking-wider block mb-1">Time</label>
               <div className="flex items-baseline">
                 <input 
                   type="number" 
                   value={msVal}
                   onChange={(e) => handleMsChange(e.target.value)}
                   className="w-full bg-transparent text-white font-mono font-bold text-xl outline-none"
                   placeholder="500"
                 />
                 <span className="text-xs text-app-subtext ml-1">ms</span>
               </div>
             </div>
           </div>
        </div>

        {/* Hz <-> Note (Swappable) */}
        <div className="bg-app-card rounded-3xl p-6 border border-white/5">
           <div className="flex items-center justify-between mb-5">
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-app-surface flex items-center justify-center text-app-subtext">
                  <Activity size={16} />
                </div>
                <h3 className="font-bold text-white">Pitch Calculator</h3>
             </div>
             <button 
               onClick={() => setIsHzToNote(!isHzToNote)}
               className="text-xs font-bold text-app-accent bg-app-accentDim px-3 py-1.5 rounded-full hover:bg-app-accent hover:text-white transition-colors"
             >
               Swap
             </button>
           </div>
           
           <div className="bg-app-surface p-4 rounded-2xl border border-white/5 flex flex-col gap-4">
             {isHzToNote ? (
               // Mode A: Hz -> Note
               <>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-app-subtext font-medium">Frequency</span>
                   <div className="flex items-baseline gap-1">
                      <input 
                        type="number" 
                        value={hzInput}
                        onChange={(e) => setHzInput(e.target.value)}
                        className="bg-transparent text-right text-white font-mono font-bold text-lg w-24 outline-none border-b border-transparent focus:border-app-accent"
                      />
                      <span className="text-xs text-app-subtext">Hz</span>
                   </div>
                 </div>
                 <div className="h-px bg-white/5 w-full"></div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-app-subtext font-medium">Note</span>
                   <span className="font-bold text-app-accent text-xl">{noteOutput}</span>
                 </div>
               </>
             ) : (
               // Mode B: Note -> Hz
               <>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-app-subtext font-medium">Note Selection</span>
                   <div className="flex gap-2">
                     {/* Note Dropdown */}
                     <div className="relative">
                        <select 
                            value={selectedNote}
                            onChange={(e) => setSelectedNote(e.target.value)}
                            className="appearance-none bg-black/40 text-white font-mono font-bold text-lg pl-3 pr-8 py-1 rounded-lg border border-white/10 outline-none focus:border-app-accent transition-colors cursor-pointer"
                        >
                            {NOTES.map(n => <option key={n} value={n} className="bg-black">{n}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                     </div>

                     {/* Octave Dropdown */}
                     <div className="relative">
                        <select 
                            value={selectedOctave}
                            onChange={(e) => setSelectedOctave(e.target.value)}
                            className="appearance-none bg-black/40 text-white font-mono font-bold text-lg pl-3 pr-8 py-1 rounded-lg border border-white/10 outline-none focus:border-app-accent transition-colors cursor-pointer"
                        >
                            {OCTAVES.map(o => <option key={o} value={o} className="bg-black">{o}</option>)}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white/50">
                          <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                        </div>
                     </div>
                   </div>
                 </div>
                 <div className="h-px bg-white/5 w-full"></div>
                 <div className="flex justify-between items-center">
                   <span className="text-sm text-app-subtext font-medium">Frequency</span>
                   <span className="font-bold text-purple-400 text-xl">{hzOutput} <span className="text-sm text-white/50">Hz</span></span>
                 </div>
               </>
             )}
           </div>
        </div>
      </section>

      {/* --- Section 3: Tuner --- */}
      <section className="bg-app-card rounded-3xl p-6 shadow-lg border border-white/5">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-white text-lg font-bold">Instrument Tuner</h2>
            <p className="text-app-subtext text-xs">Chromatic • 440Hz</p>
          </div>
          <button 
            onClick={toggleTuner}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isTunerActive ? 'bg-app-accent text-white shadow-[0_0_20px_#3b82f6]' : 'bg-app-surface text-app-subtext hover:text-white'}`}
          >
            {isTunerActive ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
        </div>

        <div className="flex flex-col items-center justify-center h-48 bg-black rounded-2xl relative border border-white/10 shadow-inner overflow-hidden">
           {!isTunerActive ? (
             <div className="flex flex-col items-center text-app-subtext/50 gap-2">
               <Mic size={32} />
               <span className="text-sm font-medium">Tap mic to start</span>
             </div>
           ) : pitch ? (
             <>
               <div className="relative z-10 flex flex-col items-center">
                 <div className="text-7xl font-bold text-white tracking-tighter drop-shadow-lg mb-1">{pitch.note}</div>
                 <div className="text-app-subtext font-mono text-sm tracking-widest opacity-80">{pitch.freq.toFixed(1)} HZ</div>
               </div>
               
               {/* Tuning Needle/Bar */}
               <div className="absolute bottom-6 w-3/4 max-w-[200px] h-1.5 bg-app-surface rounded-full">
                 {/* Center Marker */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-3 bg-white/20"></div>
                 
                 {/* Moving Dot */}
                 <div 
                   className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full shadow-[0_0_10px_currentColor] transition-all duration-150 ease-out border-2 border-app-card ${Math.abs(pitch.cents) < 5 ? 'bg-app-accent text-app-accent left-1/2' : 'bg-red-500 text-red-500'}`}
                   style={{ 
                     left: `calc(50% + ${pitch.cents * 1.5}px)`,
                     transform: 'translate(-50%, -50%)'
                   }} 
                 />
               </div>
               
               <div className={`absolute bottom-2 text-[10px] font-bold uppercase tracking-wider ${Math.abs(pitch.cents) < 5 ? 'text-app-accent' : 'text-app-subtext'}`}>
                 {Math.abs(pitch.cents) < 5 ? 'In Tune' : pitch.cents > 0 ? `+${pitch.cents} Sharp` : `${pitch.cents} Flat`}
               </div>
             </>
           ) : (
             <div className="flex flex-col items-center text-app-accent animate-pulse">
               <Activity size={32} />
               <span className="text-xs font-bold mt-2 uppercase tracking-widest">Listening</span>
             </div>
           )}
        </div>
      </section>
    </div>
  );
};

export default Tools;