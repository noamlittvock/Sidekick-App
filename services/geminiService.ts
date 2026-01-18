import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisResult } from '../types';

const getAiClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

export const analyzeAudioClip = async (base64Audio: string): Promise<AnalysisResult> => {
  const ai = getAiClient();

  const prompt = `Analyze this audio clip. 
  1. Detect the tempo (BPM). If unsure, estimate.
  2. Detect the musical key (e.g., C Major, F# Minor). If it's just noise/drums, return "Percussive".
  
  Return valid JSON only.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bpm: { type: Type.NUMBER },
            key: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return { bpm: 0, key: "Unknown" };
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return { bpm: 0, key: "Error" };
  }
};

export const audioToMidiData = async (base64Audio: string, mode: 'melody' | 'rhythm'): Promise<AnalysisResult> => {
  const ai = getAiClient();

  const prompt = mode === 'melody' 
    ? "Analyze this audio melody. Extract the notes. Return a JSON object with 'bpm' and an array of 'notes'. Each note should have 'note' (MIDI number 0-127), 'velocity' (0-127), 'startTime' (seconds), 'duration' (seconds)."
    : "Analyze this drum/beatbox audio. Convert to MIDI drum notes (Kick=36, Snare=38, HiHat=42). Return JSON with 'bpm' and 'notes' array.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bpm: { type: Type.NUMBER },
            notes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  note: { type: Type.NUMBER },
                  velocity: { type: Type.NUMBER },
                  startTime: { type: Type.NUMBER },
                  duration: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return {};
    return JSON.parse(text) as AnalysisResult;
  } catch (error) {
    console.error("Gemini Voice2Midi Error:", error);
    return {};
  }
};
