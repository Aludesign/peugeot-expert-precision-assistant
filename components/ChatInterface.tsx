
import React, { useState, useRef, useEffect } from 'react';
import { User, ChatSession, Message, Complaint } from '../types';
import { backend } from '../backendService';
import { getGeminiResponse, generateSpeech } from '../geminiService';
import { GoogleGenAI, Modality } from '@google/genai';

interface ChatInterfaceProps {
  user: User;
  sessions: ChatSession[];
  setSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  onLogout: () => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ user, sessions, setSessions, onLogout }) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [isSpeechEnabled, setIsSpeechEnabled] = useState(true);
  const [uploadedImage, setUploadedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [complaintText, setComplaintText] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const liveSessionRef = useRef<any>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeSession?.messages, isTyping]);

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes;
  };

  const decodeAudioData = async (data: Uint8Array, ctx: AudioContext, sampleRate: number) => {
    const dataInt16 = new Int16Array(data.buffer);
    const buffer = ctx.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < dataInt16.length; i++) channelData[i] = dataInt16[i] / 32768.0;
    return buffer;
  };

  const playTTS = async (text: string, messageId: string) => {
    if (!isSpeechEnabled) return;
    const base64Audio = await generateSpeech(text);
    if (!base64Audio) return;
    if (!audioContextRef.current) audioContextRef.current = new AudioContext({ sampleRate: 24000 });
    const ctx = audioContextRef.current;
    const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    setPlayingMessageId(messageId);
    source.onended = () => setPlayingMessageId(null);
    source.start();
  };

  const toggleLive = async () => {
    if (isLive) {
      liveSessionRef.current?.close();
      setIsLive(false);
      return;
    }
    // @ts-ignore - process.env.API_KEY is defined by Vite config
    const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || (import.meta as any).env.VITE_GEMINI_API_KEY || "";
    const ai = new GoogleGenAI({ apiKey });
    let nextStartTime = 0;
    const outCtx = new AudioContext({ sampleRate: 24000 });
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-09-2025',
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: "Du är rösten för Peugeot Precision Assistant. Teknisk, kortfattad och professionell på svenska.",
      },
      callbacks: {
        onopen: () => {
          const inCtx = new AudioContext({ sampleRate: 16000 });
          const source = inCtx.createMediaStreamSource(stream);
          const processor = inCtx.createScriptProcessor(4096, 1, 1);
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const int16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
            const base64 = btoa(String.fromCharCode(...new Uint8Array(int16.buffer)));
            sessionPromise.then(s => s.sendRealtimeInput({ media: { data: base64, mimeType: 'audio/pcm;rate=16000' } }));
          };
          source.connect(processor);
          processor.connect(inCtx.destination);
        },
        onmessage: async (msg) => {
          const audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (audio) {
            nextStartTime = Math.max(nextStartTime, outCtx.currentTime);
            const buf = await decodeAudioData(decode(audio), outCtx, 24000);
            const node = outCtx.createBufferSource();
            node.buffer = buf;
            node.connect(outCtx.destination);
            node.start(nextStartTime);
            nextStartTime += buf.duration;
          }
        },
        onclose: () => setIsLive(false),
        onerror: () => setIsLive(false)
      }
    });
    liveSessionRef.current = await sessionPromise;
    setIsLive(true);
  };

  const handleSend = async () => {
    if (!input.trim() && !uploadedImage) return;
    let currentId = activeSessionId || Date.now().toString();
    if (!activeSessionId) {
      const newS: ChatSession = { id: currentId, title: `Diagnostik: ${new Date().toLocaleTimeString()}`, date: new Date().toLocaleDateString(), messages: [] };
      setSessions(p => [newS, ...p]);
      setActiveSessionId(currentId);
    }
    const userMsgId = Date.now().toString();
    const userMsg: Message = { id: userMsgId, role: 'user', content: input || "BILDANALYS UTFÖRS", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setSessions(prev => prev.map(s => s.id === currentId ? { ...s, messages: [...s.messages, userMsg] } : s));
    const currentInput = input;
    const currentImg = uploadedImage;
    setInput(''); setUploadedImage(null); setIsTyping(true);

    const history = (sessions.find(s => s.id === currentId)?.messages || []).map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] }));
    const aiRes = await getGeminiResponse(currentInput, history, currentImg || undefined);

    const assistantMsgId = (Date.now() + 1).toString();
    const assistantMsg: Message = { id: assistantMsgId, role: 'assistant', content: aiRes, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setSessions(prev => prev.map(s => s.id === currentId ? { ...s, messages: [...s.messages, assistantMsg] } : s));
    setIsTyping(false);
    playTTS(aiRes, assistantMsgId);
  };

  const handleSubmitComplaint = () => {
    if (!complaintText.trim()) return;
    const newComplaint: Complaint = {
      id: Date.now().toString(),
      date: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString(),
      customerName: "Kundtjänst Fall",
      content: complaintText,
      status: 'new'
    };
    backend.saveComplaint(newComplaint);
    setComplaintText('');
    setIsComplaintModalOpen(false);
  };

  return (
    <div className="fixed inset-0 flex luxury-gradient overflow-hidden mono">
      {/* Sidebar Overlay for Mobile */}
      <div className={`fixed inset-0 z-40 lg:hidden bg-black/80 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:relative z-50 w-72 h-full glass-sidebar flex flex-col transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-amber-900/10 flex justify-between items-center">
          <div>
            <h2 className="text-xs gold-text tracking-[0.4em] font-black uppercase mb-1">Kontrollcenter</h2>
            <p className="text-[10px] text-gray-500 tracking-widest uppercase opacity-70">Op: {user.username}</p>
          </div>
          <button className="lg:hidden text-amber-500" onClick={() => setIsSidebarOpen(false)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-8 px-4 space-y-3 custom-scroll">
          <button onClick={() => { setActiveSessionId(null); setIsSidebarOpen(false); }} className="w-full mb-3 py-4 bg-amber-900/5 border border-amber-600/20 text-amber-500/80 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-amber-900/15 transition-all rounded active:scale-[0.98]">
            + NY DIAGNOSTIKSESSION
          </button>
          <button onClick={() => { setIsComplaintModalOpen(true); setIsSidebarOpen(false); }} className="w-full mb-6 py-4 bg-red-900/5 border border-red-600/20 text-red-400/80 text-[10px] uppercase tracking-[0.3em] font-bold hover:bg-red-900/10 transition-all rounded active:scale-[0.98]">
            ! ANMÄL KLAGOMÅL
          </button>
          {sessions.map((s: { id: any; title: any; date: any; }) => (
            <button key={s.id} onClick={() => { setActiveSessionId(s.id); setIsSidebarOpen(false); }} className={`w-full text-left p-4 rounded border transition-all ${activeSessionId === s.id ? 'bg-amber-900/10 border-amber-600/40 gold-glow' : 'border-transparent hover:border-amber-900/20 hover:bg-white/5'}`}>
              <p className="text-[10px] text-gray-300 font-bold truncate tracking-wide">{s.title}</p>
              <div className="flex justify-between items-center mt-2">
                <p className="text-[8px] text-gray-600 uppercase tracking-tighter">{s.date}</p>
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500/20"></div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 bg-black/40 border-t border-amber-900/10 space-y-6">
          <div className="flex items-center justify-between text-[9px] text-gray-500">
            <div className="flex items-center space-x-3">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_green] animate-pulse"></div>
              <span className="tracking-widest">ECU: ANSLUTEN</span>
            </div>
            <button onClick={onLogout} className="text-gray-700 hover:text-red-500 transition-colors uppercase font-bold tracking-tighter">Logga ut</button>
          </div>
        </div>
      </aside>

      {/* Primary Terminal View */}
      <main className="flex-1 flex flex-col relative w-full overflow-hidden">
        <header className="px-4 md:px-10 py-4 md:py-6 flex justify-between items-center border-b border-amber-900/10 bg-black/40 backdrop-blur-xl z-30">
          <div className="flex items-center space-x-4 md:space-x-10">
            <button className="lg:hidden p-2 text-amber-500" onClick={() => setIsSidebarOpen(true)}>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            </button>
            <div>
              <p className="text-[8px] text-gray-600 uppercase tracking-[0.2em] mb-0.5">Enhet</p>
              <p className="text-xs md:text-sm gold-text font-black tracking-widest">BER 088</p>
            </div>
            <div className="hidden sm:block h-8 w-px bg-amber-900/20"></div>
            <div className="hidden sm:block">
              <p className="text-[8px] text-gray-600 uppercase tracking-[0.2em] mb-1">Röstutmatning</p>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setIsSpeechEnabled(!isSpeechEnabled)}
                  className={`relative w-8 h-4 rounded-full transition-colors ${isSpeechEnabled ? 'bg-amber-600/30' : 'bg-gray-800'}`}
                >
                  <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isSpeechEnabled ? 'right-0.5 bg-amber-400' : 'left-0.5 bg-gray-500'}`}></div>
                </button>
                <span className={`text-[9px] uppercase tracking-tighter ${isSpeechEnabled ? 'gold-text' : 'text-gray-600'}`}>
                  {isSpeechEnabled ? 'Aktiv' : 'Av'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[8px] text-gray-600 uppercase tracking-[0.2em] mb-0.5">Chassi</p>
            <p className="text-[9px] md:text-[10px] text-gray-400 font-bold tracking-tight">...64189021</p>
          </div>
        </header>

        {/* Message Stream */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 md:px-24 py-8 md:py-12 space-y-8 md:space-y-12 custom-scroll">
          {(!activeSession || activeSession.messages.length === 0) && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-30">
              <div className="w-16 h-16 md:w-20 md:h-20 border border-amber-600/20 rounded-lg flex items-center justify-center relative overflow-hidden">
                <svg className="w-8 h-8 gold-text" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
              </div>
              <p className="text-[10px] md:text-[11px] tracking-[0.8em] gold-text uppercase font-light animate-pulse">Diagnostik Redo</p>
            </div>
          )}
          {activeSession?.messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start animate-in slide-in-from-left-2'}`}>
              <div className={`max-w-[95%] md:max-w-[85%] lg:max-w-[70%] rounded-sm ${m.role === 'user' ? 'p-5 md:p-7 chat-bubble-user text-right' : 'chat-bubble-assistant mono'}`}>
                <p className="text-[12px] md:text-[13px] leading-relaxed tracking-tight text-gray-200 whitespace-pre-wrap">{m.content}</p>
              </div>
              <div className="flex items-center space-x-3 mt-3 px-1">
                <span className="text-[8px] text-gray-600 uppercase tracking-[0.4em] font-black">
                  {m.role === 'assistant' ? 'LOGG' : 'INPUT'}
                </span>
                <span className="text-[8px] text-gray-800">//</span>
                <div className="flex items-center space-x-2">
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest">{m.timestamp}</span>
                  {playingMessageId === m.id && (
                    <div className="flex items-end space-x-0.5 h-2">
                      <div className="w-0.5 bg-amber-500 animate-[bounce_0.6s_infinite]"></div>
                      <div className="w-0.5 bg-amber-500 animate-[bounce_0.6s_infinite_0.1s]"></div>
                      <div className="w-0.5 bg-amber-500 animate-[bounce_0.6s_infinite_0.2s]"></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex items-center space-x-4 animate-pulse">
              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
              <div className="text-amber-500/60 text-[9px] tracking-[0.5em] uppercase font-bold">Diagnostik...</div>
            </div>
          )}
        </div>

        {/* Diagnostic Control Board */}
        <div className="p-4 md:p-10 md:px-24 bg-black/60 border-t border-amber-900/10 backdrop-blur-2xl">
          <div className="max-w-5xl mx-auto space-y-4 md:space-y-8">
            {uploadedImage && (
              <div className="flex items-center space-x-4 md:space-x-6 p-3 md:p-5 bg-amber-900/5 border border-amber-600/30 rounded-sm">
                <img src={`data:${uploadedImage.mimeType};base64,${uploadedImage.data}`} className="h-12 w-12 md:h-20 md:w-20 object-cover rounded-sm border border-amber-900/50" />
                <div className="flex-1">
                  <p className="text-[9px] md:text-[10px] gold-text font-black uppercase tracking-widest">VISUELL BUFFERT REDO</p>
                </div>
                <button onClick={() => setUploadedImage(null)} className="p-2 text-red-900">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
              </div>
            )}

            <div className="flex items-center bg-black/80 border border-amber-900/20 rounded-sm overflow-hidden input-focus-glow transition-all shadow-2xl">
              <button onClick={() => fileInputRef.current?.click()} className="p-4 md:p-6 text-gray-600 hover:text-amber-500 transition-colors border-r border-amber-900/5">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onloadend = () => setUploadedImage({ data: (r.result as string).split(',')[1], mimeType: f.type });
                  r.readAsDataURL(f);
                }
              }} accept="image/*" className="hidden" />

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="flex-1 bg-transparent border-none text-white px-4 md:px-8 text-[12px] md:text-[13px] tracking-wider focus:outline-none placeholder:text-gray-800"
                placeholder="KOMMANDO..."
              />

              <div className="flex border-l border-amber-900/5">
                <button onClick={toggleLive} className={`p-4 md:p-6 ${isLive ? 'text-red-500 pulse-gold' : 'text-gray-600'}`}>
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"></path></svg>
                </button>
                <button onClick={handleSend} disabled={isTyping} className="bg-amber-900/10 px-6 md:px-10 py-4 md:py-6 gold-text text-[10px] md:text-[11px] font-black tracking-widest hover:bg-amber-900/20 disabled:opacity-20 border-l border-amber-900/10">
                  KÖR
                </button>
              </div>
            </div>

            <div className="flex justify-center flex-wrap gap-4 md:gap-8 opacity-40 hover:opacity-100 transition-opacity pb-2 md:pb-0">
              {['ÅTDRAGNING', 'KAMREM', 'FELKODER'].map(t => (
                <button key={t} onClick={() => setInput(t)} className="text-[8px] md:text-[9px] text-gray-500 hover:text-amber-600 uppercase tracking-widest font-bold">
                  [ {t} ]
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
      <style>{`
        @keyframes bounce {
          0%, 100% { height: 4px; }
          50% { height: 10px; }
        }
      `}</style>

      {
        isComplaintModalOpen && (
          <div className="fixed inset-0 z-[60] bg-[#050807]/95 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-lg bg-[#0c1410] border border-amber-900/30 p-8 rounded shadow-2xl relative">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500/50 to-transparent"></div>
              <h2 className="text-xs text-red-500 tracking-[0.4em] font-black uppercase mb-6">Registrera Kundavvikelse</h2>
              <textarea
                value={complaintText}
                onChange={(e) => setComplaintText(e.target.value)}
                className="w-full h-40 bg-black/40 border border-amber-900/20 rounded p-4 text-xs text-white focus:outline-none focus:border-red-900/50 mb-6 placeholder:text-gray-700 resize-none"
                placeholder="BESKRIV HÄNDELSEFÖRLOPP OCH KUNDENS UPPLEVELSE..."
                autoFocus
              />
              <div className="flex justify-end space-x-4">
                <button onClick={() => setIsComplaintModalOpen(false)} className="text-[9px] text-gray-500 hover:text-white uppercase tracking-widest px-4 py-2 font-bold">Avbryt</button>
                <button onClick={handleSubmitComplaint} className="bg-red-900/20 border border-red-600/30 text-red-500 text-[9px] font-bold tracking-[0.3em] uppercase px-6 py-3 hover:bg-red-900/30 rounded transition-all">
                  Arkivera Rapport
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default ChatInterface;
