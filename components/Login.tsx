
import React, { useState } from 'react';

interface LoginProps {
  onLogin: (user: string) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [vinKey, setVinKey] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'AUTHORIZING' | 'ERROR'>('IDLE');
  const [bootLogs, setBootLogs] = useState<string[]>([]);

  const VALID_VIN = "VF3XS9HUC64189021";
  const VALID_REG = "BER088";

  const sequence = [
    "INITIERAR KÄRNA...",
    "HANDSKAKNING MED ECU: 1.6 HDi...",
    "VALIDERAR VIN: " + VALID_VIN + "...",
    "KRYPTERAR SESSION...",
    "ÅTKOMST BEVILJAD."
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = vinKey.trim().toUpperCase();
    
    if (input !== VALID_VIN && input !== VALID_REG) {
      setStatus('ERROR');
      setTimeout(() => setStatus('IDLE'), 2000);
      return;
    }

    setStatus('AUTHORIZING');
    sequence.forEach((text, i) => {
      setTimeout(() => {
        setBootLogs(prev => [...prev, `[OK] ${text}`]);
        if (i === sequence.length - 1) {
          setTimeout(() => onLogin(username), 600);
        }
      }, (i + 1) * 350);
    });
  };

  return (
    <div className="min-h-screen luxury-gradient flex items-center justify-center p-6 mono">
      <div className="w-full max-w-lg relative">
        <div className={`transition-all duration-1000 ${status === 'AUTHORIZING' ? 'opacity-0 scale-95' : 'opacity-100'}`}>
          <div className="bg-[#0c1410]/95 backdrop-blur-xl border border-amber-900/30 p-10 rounded shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>
            
            <div className="text-center mb-10">
              <div className="inline-block p-4 bg-amber-900/10 rounded-full mb-4 border border-amber-600/20">
                <svg className="w-10 h-10 gold-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0012 3c1.256 0 2.454.232 3.559.656m1.306 1.45L16.5 7m4.5 4.5l-1.5-.5M15 15l-3-3m0 0l-3 3m3-3V15" />
                </svg>
              </div>
              <h1 className="text-2xl gold-text tracking-[0.4em] font-light uppercase">Systemåtkomst</h1>
              <p className="text-[10px] text-gray-500 tracking-widest mt-2 uppercase">Fordon: BER088 // Expert 2008</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 tracking-[0.3em] uppercase block">Tekniker-ID</label>
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/40 border border-amber-900/20 rounded px-5 py-4 text-white text-xs focus:outline-none focus:border-amber-600/50 transition-all placeholder:text-gray-800"
                  placeholder="NAMN / OPERATÖR"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 tracking-[0.3em] uppercase block">Åtkomstkod (VIN eller REG)</label>
                <input 
                  type="password" 
                  value={vinKey}
                  onChange={(e) => setVinKey(e.target.value)}
                  className={`w-full bg-black/40 border rounded px-5 py-4 text-white text-xs focus:outline-none transition-all placeholder:text-gray-800 ${status === 'ERROR' ? 'border-red-900/50 bg-red-900/5' : 'border-amber-900/20 focus:border-amber-600/50'}`}
                  placeholder="•••••••••••••••••"
                  required
                />
                {status === 'ERROR' && <p className="text-[8px] text-red-500 tracking-tighter uppercase mt-1">Felaktig kod: Åtkomst nekad</p>}
              </div>

              <button 
                type="submit"
                disabled={status === 'AUTHORIZING'}
                className="w-full py-5 bg-amber-900/20 border border-amber-600/50 gold-text text-[11px] font-bold tracking-[0.5em] uppercase hover:bg-amber-900/30 transition-all rounded"
              >
                Verifiera anslutning
              </button>
            </form>
          </div>
        </div>

        {status === 'AUTHORIZING' && (
          <div className="fixed inset-0 z-50 bg-[#050807] flex items-center justify-center p-8">
            <div className="w-full max-w-sm space-y-2 font-mono">
              {bootLogs.map((log, i) => (
                <div key={i} className="text-[10px] text-amber-500/90 flex justify-between">
                  <span>{log}</span>
                  <span className="opacity-50">STG_{(Math.random() * 99).toFixed(0)}</span>
                </div>
              ))}
              <div className="w-2 h-4 bg-amber-500 animate-pulse mt-2"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
