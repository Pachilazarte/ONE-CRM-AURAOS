'use client';

import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/types';
import { Server, ServerOff } from 'lucide-react';

type ServerStatus = 'checking' | 'online' | 'offline';

export default function ServerStatusBanner() {
  const [status, setStatus] = useState<ServerStatus>('checking');
  const [showTooltip, setShowTooltip] = useState(false);

  const checkHealth = () => {
    const url = `${API_BASE.replace('/api/v1', '')}/health`;
    fetch(url, { signal: AbortSignal.timeout(8000) })
      .then(r => r.ok ? setStatus('online') : setStatus('offline'))
      .catch(() => setStatus('offline'));
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') return null;

  const isOnline = status === 'online';

  return (
    <div className="relative px-3 pb-2">
      <div
        className={`relative flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all border ${
          isOnline
            ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/15'
            : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/15'
        }`}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={isOnline ? undefined : checkHealth}
      >
        {isOnline ? (
          <Server size={12} className="text-emerald-400 shrink-0" />
        ) : (
          <ServerOff size={12} className="text-red-400 shrink-0 animate-pulse" />
        )}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
              isOnline ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]' : 'bg-red-400 animate-pulse'
            }`}
          />
          <span
            className={`text-[9px] font-extrabold uppercase tracking-widest ${
              isOnline ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isOnline ? 'Servidor Activo' : 'Servidor Inactivo'}
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-3 right-3 mb-2 z-50">
          <div className="bg-[#1a1520] border border-white/10 rounded-xl p-3 shadow-2xl">
            <p className="text-[10px] text-[#a4a8c0] leading-relaxed">
              {isOnline ? (
                <>
                  <span className="text-emerald-400 font-bold">✓ Conectado</span> a Render.{' '}
                  El servidor está procesando peticiones normalmente.
                </>
              ) : (
                <>
                  <span className="text-red-400 font-bold">⚠ Sin conexión</span> con Render.{' '}
                  El servidor puede estar en modo sleep (free tier). Tarda ~30 seg en despertar.{' '}
                  <span className="text-[#e17bd7] font-bold">Hacé clic para reintentar.</span>
                </>
              )}
            </p>
          </div>
          <div className={`w-2 h-2 mx-4 rotate-45 -mt-1 ${isOnline ? 'bg-[#1a1520] border-b border-r border-white/10' : 'bg-[#1a1520] border-b border-r border-white/10'}`} />
        </div>
      )}
    </div>
  );
}
