'use client';

import React, { useState, useEffect } from 'react';
import { Zap, Sparkles, Timer, Eye, Clock, Award, RefreshCcw, Play, ShieldCheck, KeyRound, CheckCircle, AlertCircle } from 'lucide-react';
import type { Analysis } from '@/lib/types';
import { API_BASE } from '@/lib/types';

export default function ExtraccionPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [targetAccount, setTargetAccount] = useState('');
  const [maxFollowers, setMaxFollowers] = useState(-1);
  const [isStarting, setIsStarting] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [resetCursor, setResetCursor]   = useState(false);
  const [selectedError, setSelectedError]   = useState<string | null>(null);
  
  const [hibernate, setHibernate] = useState(false);
  const [usernames, setUsernames] = useState('');
  const [activeTab, setActiveTab] = useState<'followers' | 'manual'>('followers');

  const fetchAnalyses = () =>
    fetch(`${API_BASE}/scraping/status/all`)
      .then(r => r.json())
      .then(d => setAnalyses(Array.isArray(d) ? d : []))
      .catch(() => {});

  useEffect(() => {
    fetchAnalyses();
    const interval = setInterval(fetchAnalyses, 4000);
    return () => clearInterval(interval);
  }, []);

  const activeJob = analyses.find(a => a.status === 'processing' || a.status === 'pending');

  useEffect(() => {
    if (activeJob?.status === 'processing') {
      const t = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
      return () => clearInterval(t);
    }
    setElapsedSeconds(0);
  }, [activeJob?.id, activeJob?.status]);

  const formatTimer = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAccount) return;
    if (activeTab === 'manual' && !usernames.trim()) return;
    setIsStarting(true);
    try {
      const res = await fetch(`${API_BASE}/scraping/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAccount: targetAccount.replace('@','').trim(),
          userId: '',
          maxFollowers: activeTab === 'manual' ? -1 : Number(maxFollowers),
          resetCursor,
          hibernate,
          usernames: activeTab === 'manual' ? usernames.trim() : '',
        }),
      });
      if (res.ok) {
        setTargetAccount('');
        setUsernames('');
        setElapsedSeconds(0);
        fetchAnalyses();
      }
    } catch {
      alert('Error al iniciar el análisis');
    } finally {
      setIsStarting(false);
    }
  };

  const vistas    = activeJob?.usersAnalyzed ?? 0;
  const maxLimit  = activeJob?.maxFollowers  ?? maxFollowers;
  const pendientes = Math.max(0, maxLimit - vistas);

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#e17bd7]/5 blur-[150px] rounded-full -mr-60 -mt-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#6be1e3]/3 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}      <div>
        <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
          <Zap size={22} className="text-[#e17bd7]" />
          Extracción de Datos
          <span className="text-[9px] font-bold text-[#6be1e3]/70 bg-[#6be1e3]/10 border border-[#6be1e3]/20 px-2 py-0.5 rounded-full uppercase tracking-widest ml-1">v1.0.4</span>
        </h1>
        <p className="text-xs text-[#a4a8c0] mt-0.5">Extrae leads con email de los seguidores de una cuenta de Instagram.</p>
      </div>

      {/* Dedup notice */}
      <div className="flex items-center gap-3 glass-card px-4 py-3 rounded-xl border-[#6be1e3]/10">
        <ShieldCheck size={15} className="text-[#6be1e3] shrink-0" />
        <p className="text-[11px] text-[#a4a8c0]">
          <span className="text-[#6be1e3] font-bold">Deduplicación activa</span> — emails ya existentes se omiten automáticamente. Solo se guardan leads con email verificado.
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#e17bd7]/5 blur-3xl rounded-full" />
          <h3 className="text-base font-extrabold font-exo flex items-center gap-2 border-b border-white/5 pb-2">
            <Sparkles size={15} className="text-[#e17bd7]" />
            Configurar Extracción
          </h3>

          {/* Mode Tabs */}
          <div className="flex border-b border-white/5 pb-1">
            <button
              type="button"
              onClick={() => { setActiveTab('followers'); setTargetAccount(''); }}
              className={`flex-1 pb-2 text-center text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                activeTab === 'followers'
                  ? 'text-[#e17bd7] border-b-2 border-[#e17bd7]'
                  : 'text-[#a4a8c0]/60 hover:text-[#a4a8c0]'
              }`}
            >
              Seguidores
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('manual'); setTargetAccount('barrido_manual'); }}
              className={`flex-1 pb-2 text-center text-[10px] font-extrabold uppercase tracking-widest transition-all ${
                activeTab === 'manual'
                  ? 'text-[#e17bd7] border-b-2 border-[#e17bd7]'
                  : 'text-[#a4a8c0]/60 hover:text-[#a4a8c0]'
              }`}
            >
              Barrido Manual
            </button>
          </div>

          <form onSubmit={handleStart} className="space-y-4">
            {activeTab === 'followers' ? (
              <>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Usuario de Instagram
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a4a8c0]/60 text-sm">@</span>
                    <input
                      id="target-account-input"
                      type="text" required={activeTab === 'followers'} value={targetAccount === 'barrido_manual' ? '' : targetAccount}
                      onChange={e => setTargetAccount(e.target.value)}
                      placeholder="ej: positivo.rrhh"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Profundidad de búsqueda
                  </label>
                  <select id="max-followers-select" aria-label="Profundidad de búsqueda" value={maxFollowers} onChange={e => setMaxFollowers(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-[#fefeff] focus:outline-none focus:border-[#e17bd7] cursor-pointer">
                    <option value={10}>10 perfiles — prueba rápida</option>
                    <option value={50}>50 perfiles — rápido</option>
                    <option value={100}>100 perfiles — normal</option>
                    <option value={500}>500 perfiles — completo</option>
                    <option value={1000}>1 000 perfiles — profundo</option>
                    <option value={-1}>✨ Automático (Detectar total de seguidores)</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Segmento / Origen de Leads
                  </label>
                  <div className="relative">
                    <input
                      id="target-segment-input"
                      type="text" required={activeTab === 'manual'} value={targetAccount === 'barrido_manual' ? '' : targetAccount}
                      onChange={e => setTargetAccount(e.target.value)}
                      placeholder="ej: barrido_manual"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Lista de Usuarios a enriquecer
                  </label>
                  <textarea
                    id="manual-usernames-textarea"
                    rows={4} required={activeTab === 'manual'} value={usernames}
                    onChange={e => setUsernames(e.target.value)}
                    placeholder="ej: victor.r, laura_per, positivo.rrhh"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all resize-none font-mono"
                  />
                  <p className="text-[8px] text-[#a4a8c0]/50">Nombres de usuario separados por comas para buscar directamente sin paginar seguidores.</p>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-white/5 space-y-3">
              {activeTab === 'followers' && (
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="reset-cursor-checkbox"
                    type="checkbox"
                    checked={resetCursor}
                    onChange={e => setResetCursor(e.target.checked)}
                    className="mt-0.5 accent-[#e17bd7]"
                  />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#a4a8c0]/80">
                    Empezar desde el principio <br/><span className="text-[8px] lowercase opacity-70">(ignorar progreso guardado)</span>
                  </span>
                </label>
              )}
              
              <label className="flex items-center justify-between cursor-pointer py-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#a4a8c0]/80 flex items-center gap-1">
                    Modo Hibernación
                  </span>
                  <span className="text-[8px] text-[#a4a8c0]/50 lowercase">Pausas ultra-seguras anti-bloqueo</span>
                </div>
                <div className="relative inline-flex items-center">
                  <input
                    id="hibernate-toggle"
                    type="checkbox"
                    checked={hibernate}
                    onChange={e => setHibernate(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-black/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#a4a8c0] after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:bg-[#6be1e3] peer-checked:bg-[#e17bd7]/20 border border-white/10" />
                </div>
              </label>
            </div>

            <button id="run-scraper-button" type="submit"
              disabled={(!targetAccount && activeTab === 'followers') || (activeTab === 'manual' && !usernames.trim()) || isStarting || !!activeJob}
              className="btn-one w-full flex items-center justify-center gap-2 py-4 text-xs uppercase tracking-widest font-black disabled:opacity-30 disabled:cursor-not-allowed">
              {isStarting
                ? <RefreshCcw className="animate-spin" size={15} />
                : <><Play size={13} className="fill-current" />Ejecutar Scraper</>}
            </button>
          </form>
        </div>

        {/* Live HUD */}
        <div className="glass-card p-6 rounded-2xl lg:col-span-2 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-base font-extrabold font-exo flex items-center gap-2">
                <Timer size={15} className="text-[#6be1e3] animate-pulse" />
                Consola en Vivo
              </h3>
              <p className="text-[11px] text-[#a4a8c0]">Monitoreo del subproceso Python en tiempo real.</p>
            </div>
            {activeJob?.status === 'processing' && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#6be1e3]/10 border border-[#6be1e3]/20 animate-pulse">
                <span className="w-1.5 h-1.5 bg-[#6be1e3] rounded-full" />
                <span className="text-[9px] font-extrabold text-[#6be1e3] uppercase tracking-widest">Captura activa</span>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-12 gap-4 items-center">
            <div className="col-span-12 md:col-span-5 bg-black/40 border border-white/5 rounded-xl p-5 flex flex-col items-center justify-center min-h-32">
              {activeJob?.status === 'processing' ? (
                <div className="text-center space-y-2">
                  <div className="text-[9px] font-extrabold tracking-widest text-[#a4a8c0] uppercase">Tiempo Transcurrido</div>
                  <div className="font-mono text-4xl font-extrabold text-[#6be1e3] tracking-widest drop-shadow-[0_0_10px_#6be1e3]">
                    {formatTimer(elapsedSeconds)}
                  </div>
                  <div className="text-[10px] text-[#a4a8c0]/60">Ejecutando en Python</div>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <Clock size={26} className="mx-auto text-[#a4a8c0]/30" />
                  <div className="text-xs font-bold text-[#a4a8c0]/40">Sin tareas activas</div>
                </div>
              )}
            </div>

            <div className="col-span-12 md:col-span-7 grid grid-cols-2 gap-3">
              {[
                { 
                  label: 'Vistas', 
                  value: <span className="text-lg font-black font-exo text-[#6be1e3]">{vistas}</span>,    
                  icon: Eye,   
                  sub: 'perfiles escaneados' 
                },
                { 
                  label: 'Pendientes', 
                  value: activeJob && maxLimit <= 0 ? (
                    <span className="flex items-center gap-1.5 text-xs font-extrabold text-[#e4c76a] animate-pulse py-1">
                      <RefreshCcw size={11} className="animate-spin text-[#e4c76a]" />
                      Calculando...
                    </span>
                  ) : (
                    <span className="text-lg font-black font-exo text-[#e4c76a]">{pendientes}</span>
                  ), 
                  icon: Clock, 
                  sub: maxLimit <= 0 ? 'Total dinámico' : 'restantes del objetivo' 
                },
              ].map(({ label, value, icon: Icon, sub }) => (
                <div key={label} className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex flex-col justify-between min-h-[82px]">
                  <div className="flex items-center gap-1 text-[9px] font-extrabold text-[#a4a8c0] uppercase tracking-wider mb-1">
                    <Icon size={10} className="text-[#a4a8c0]" />{label}
                  </div>
                  <div>{value}</div>
                  <div className="text-[8px] text-[#a4a8c0]/60 mt-1">{sub}</div>
                </div>
              ))}
              <div className="col-span-2 bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1 text-[9px] font-extrabold text-[#a4a8c0] uppercase tracking-wider mb-1">
                    <Award size={10} className="text-[#e17bd7]" />Leads con Email
                  </div>
                  <div className="text-lg font-black text-[#e17bd7] font-exo">{activeJob?.usersFound ?? 0}</div>
                </div>
                <span className="text-[8px] font-bold text-[#a4a8c0]/40 uppercase bg-white/5 px-2 py-1 rounded border border-white/5">
                  {activeJob?.target ?? 'NINGUNO'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1 border-t border-white/5 pt-3">
            <div className="flex justify-between text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
              <span>Progreso</span>
              <span className="text-[#e17bd7]">{activeJob?.progress ?? 0}%</span>
            </div>
            <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5 p-[1px]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#e17bd7] via-[#a4a8c0] to-[#6be1e3] transition-all duration-1000 shadow-[0_0_10px_#e17bd7]"
                style={{ width: `${activeJob?.progress ?? 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>



      {/* Job History */}
      {analyses.length > 0 && (
        <section className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2 text-[#a4a8c0]">
            <Clock size={14} />Historial de Extracciones
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analyses.map(a => (
              <div key={a.id} className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 hover:border-white/10 transition-colors">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#fefeff]">@{a.target}</span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                    a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    a.status === 'processing'? 'bg-[#6be1e3]/10 text-[#6be1e3] border border-[#6be1e3]/20 animate-pulse' :
                    (a.status === 'failed' || a.status === 'error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                              'bg-white/5 text-[#a4a8c0] border border-white/5'
                  }`}>{a.status}</span>
                </div>
                <div className="text-[10px] text-[#a4a8c0] flex justify-between">
                  <span>Leads: <b className="text-[#e17bd7]">{a.usersFound}</b></span>
                  <span>Límite: <b className="text-white">{a.maxFollowers ?? 100}</b></span>
                </div>
                <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${(a.status==='failed' || a.status==='error') ? 'bg-red-500' : 'bg-gradient-to-r from-[#e17bd7] to-[#6be1e3]'}`}
                    style={{ width: `${a.progress}%` }} />
                </div>
                {a.errorMessage && (
                  <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                    <p className="text-[9px] text-red-400 truncate flex items-center gap-1 font-semibold">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{a.errorMessage}</span>
                    </p>
                    <button
                      id={`view-error-${a.id}-button`}
                      onClick={() => setSelectedError(a.errorMessage ?? null)}
                      className="text-[8px] font-extrabold uppercase tracking-wider text-[#6be1e3] hover:text-[#6be1e3]/80 transition-colors flex items-center gap-0.5"
                    >
                      Ver Detalle
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Error Details Modal Overlay */}
      {selectedError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 rounded-2xl border-red-500/20 relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl rounded-full" />
            <h3 className="text-base font-extrabold font-exo flex items-center gap-2 text-red-400 border-b border-white/5 pb-3">
              <AlertCircle size={16} />
              Detalle del Error Crítico
            </h3>
            <div className="mt-4 bg-black/40 rounded-xl p-4 border border-white/5 max-h-60 overflow-y-auto font-mono text-[10px] text-red-300 leading-relaxed whitespace-pre-wrap">
              {selectedError}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                id="close-error-modal-button"
                onClick={() => setSelectedError(null)}
                className="btn-one px-5 py-2 text-[10px] uppercase tracking-widest font-black"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
