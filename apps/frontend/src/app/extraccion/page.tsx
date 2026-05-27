'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Zap, Sparkles, Timer, Eye, Clock, Award, RefreshCcw, Play, ShieldCheck,
  StopCircle, Trash2, Info, Moon, AlertCircle, CheckCircle, Users,
} from 'lucide-react';
import type { Analysis } from '@/lib/types';
import { API_BASE } from '@/lib/types';

const RECOMMENDATION_TIPS = [
  { icon: '⚡', text: 'Sin hibernación → máximo 500 perfiles para evitar rate-limit.' },
  { icon: '🌙', text: 'Con Modo Hibernación → podés sacar hasta 10k (tarda horas).' },
  { icon: '🎯', text: 'Empezá con 1 000 para validar la calidad de la cuenta.' },
  { icon: '🔄', text: 'Si ya analizaste esta cuenta, el cursor retoma desde donde quedó.' },
];

export default function ExtraccionPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [targetAccount, setTargetAccount] = useState('');
  const [maxFollowers, setMaxFollowers] = useState<number | ''>('');
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [resetCursor, setResetCursor] = useState(false);
  const [selectedError, setSelectedError] = useState<string | null>(null);
  const [hibernate, setHibernate] = useState(false);
  const [usernames, setUsernames] = useState('');
  const [activeTab, setActiveTab] = useState<'followers' | 'manual'>('followers');
  const [hiddenJobIds, setHiddenJobIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('hidden_job_ids') || '[]'); } catch { return []; }
    }
    return [];
  });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Timer sincronizado con started_at de Supabase
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (activeJob?.status === 'processing' && activeJob.startedAt) {
      const updateElapsed = () => {
        const startMs = new Date(activeJob.startedAt!).getTime();
        const nowMs = Date.now();
        setElapsedSeconds(Math.max(0, Math.floor((nowMs - startMs) / 1000)));
      };
      updateElapsed();
      timerRef.current = setInterval(updateElapsed, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeJob?.id, activeJob?.status, activeJob?.startedAt]);

  const formatTimer = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'followers' && !targetAccount) return;
    if (activeTab === 'followers' && maxFollowers === '') return;
    if (activeTab === 'manual' && !usernames.trim()) return;
    setIsStarting(true);
    try {
      const res = await fetch(`${API_BASE}/scraping/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceAccount: (activeTab === 'manual' ? (targetAccount || 'barrido_manual') : targetAccount).replace('@', '').trim(),
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
        setMaxFollowers('');
        setElapsedSeconds(0);
        fetchAnalyses();
      }
    } catch {
      alert('Error al iniciar el análisis');
    } finally {
      setIsStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!activeJob) return;
    setIsCancelling(true);
    try {
      await fetch(`${API_BASE}/scraping/cancel/${activeJob.id}`, { method: 'POST' });
      fetchAnalyses();
    } catch {
      alert('Error al cancelar');
    } finally {
      setIsCancelling(false);
    }
  };

  const hideJob = (id: string) => {
    const next = [...hiddenJobIds, id];
    setHiddenJobIds(next);
    localStorage.setItem('hidden_job_ids', JSON.stringify(next));
  };

  const clearAllHidden = () => {
    setHiddenJobIds([]);
    localStorage.removeItem('hidden_job_ids');
  };

  const visibleAnalyses = analyses.filter(a => !hiddenJobIds.includes(a.id));
  const historyJobs = visibleAnalyses.filter(a => a.status !== 'processing' && a.status !== 'pending');

  const vistas = activeJob?.usersAnalyzed ?? 0;
  const maxLimit = activeJob?.maxFollowers && activeJob.maxFollowers > 0 ? activeJob.maxFollowers : 10000;
  const pendientes = Math.max(0, maxLimit - vistas);

  const canSubmit =
    !isStarting &&
    !activeJob &&
    (activeTab === 'followers'
      ? !!targetAccount && maxFollowers !== ''
      : !!usernames.trim());

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#e17bd7]/5 blur-[150px] rounded-full -mr-60 -mt-60 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#6be1e3]/3 blur-[100px] rounded-full pointer-events-none" />

      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
          <Zap size={22} className="text-[#e17bd7]" />
          Extracción de Datos
          <span className="text-[9px] font-bold text-[#6be1e3]/70 bg-[#6be1e3]/10 border border-[#6be1e3]/20 px-2 py-0.5 rounded-full uppercase tracking-widest ml-1">v1.0.5</span>
        </h1>
        <p className="text-xs text-[#a4a8c0] mt-0.5">Extraé leads con email de los seguidores de una cuenta de Instagram.</p>
      </div>

      {/* Dedup notice */}
      <div className="flex items-center gap-3 glass-card px-4 py-3 rounded-xl border-[#6be1e3]/10">
        <ShieldCheck size={15} className="text-[#6be1e3] shrink-0" />
        <p className="text-[11px] text-[#a4a8c0]">
          <span className="text-[#6be1e3] font-bold">Deduplicación activa</span> — emails ya existentes se omiten automáticamente. Solo se guardan leads con email verificado.
        </p>
      </div>

      {/* Recommendations banner */}
      <div className="glass-card px-4 py-3 rounded-xl border border-[#e4c76a]/15 bg-[#e4c76a]/5">
        <div className="flex items-center gap-2 mb-2">
          <Info size={13} className="text-[#e4c76a] shrink-0" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#e4c76a]">Recomendaciones de extracción</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {RECOMMENDATION_TIPS.map((tip, i) => (
            <p key={i} className="text-[10px] text-[#a4a8c0] flex gap-1.5">
              <span>{tip.icon}</span>
              <span>{tip.text}</span>
            </p>
          ))}
        </div>
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
            <button type="button" onClick={() => { setActiveTab('followers'); setTargetAccount(''); }}
              className={`flex-1 pb-2 text-center text-[10px] font-extrabold uppercase tracking-widest transition-all ${activeTab === 'followers' ? 'text-[#e17bd7] border-b-2 border-[#e17bd7]' : 'text-[#a4a8c0]/60 hover:text-[#a4a8c0]'}`}>
              Seguidores
            </button>
            <button type="button" onClick={() => { setActiveTab('manual'); }}
              className={`flex-1 pb-2 text-center text-[10px] font-extrabold uppercase tracking-widest transition-all ${activeTab === 'manual' ? 'text-[#e17bd7] border-b-2 border-[#e17bd7]' : 'text-[#a4a8c0]/60 hover:text-[#a4a8c0]'}`}>
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
                      type="text" required value={targetAccount}
                      onChange={e => setTargetAccount(e.target.value)}
                      placeholder="ej: positivo.rrhh"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Profundidad de búsqueda <span className="text-red-400">*</span>
                  </label>
                  <select
                    id="max-followers-select"
                    value={maxFollowers}
                    onChange={e => setMaxFollowers(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-bold text-[#fefeff] focus:outline-none focus:border-[#e17bd7] cursor-pointer"
                  >
                    <option value="">— Seleccioná una opción —</option>
                    <option value={10}>10 perfiles — prueba rápida</option>
                    <option value={50}>50 perfiles — rápido</option>
                    <option value={100}>100 perfiles — normal</option>
                    <option value={500}>500 perfiles — completo</option>
                    <option value={1000}>1 000 perfiles — profundo ⭐</option>
                    <option value={-1}>Vaciado Total (Hasta 10k seg.)</option>
                  </select>
                  {maxFollowers === '' && (
                    <p className="text-[9px] text-[#e4c76a]">⚠ Debés seleccionar una profundidad antes de ejecutar.</p>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Segmento / Origen de Leads
                  </label>
                  <input
                    id="target-segment-input"
                    type="text" value={targetAccount === 'barrido_manual' ? '' : targetAccount}
                    onChange={e => setTargetAccount(e.target.value)}
                    placeholder="ej: barrido_manual"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                    Lista de Usuarios a enriquecer
                  </label>
                  <textarea
                    id="manual-usernames-textarea"
                    rows={4} required value={usernames}
                    onChange={e => setUsernames(e.target.value)}
                    placeholder="ej: victor.r, laura_per, positivo.rrhh"
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all resize-none font-mono"
                  />
                  <p className="text-[8px] text-[#a4a8c0]/50">Nombres de usuario separados por comas.</p>
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
                    Empezar desde el principio <br /><span className="text-[8px] lowercase opacity-70">(ignorar progreso guardado)</span>
                  </span>
                </label>
              )}

              {/* Hibernate toggle — React-controlled, no CSS peer */}
              <div className="flex items-center justify-between py-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#a4a8c0]/80 flex items-center gap-1">
                    <Moon size={10} className={hibernate ? 'text-[#6be1e3]' : 'text-[#a4a8c0]/40'} />
                    Modo Hibernación
                  </span>
                  <span className="text-[8px] text-[#a4a8c0]/50 lowercase">Pausas ultra-seguras anti-bloqueo</span>
                </div>
                <button
                  id="hibernate-toggle"
                  type="button"
                  onClick={() => setHibernate(v => !v)}
                  className={`relative w-9 h-5 rounded-full transition-all duration-300 border focus:outline-none ${
                    hibernate
                      ? 'bg-[#e17bd7]/20 border-[#e17bd7]/40'
                      : 'bg-black/50 border-white/10'
                  }`}
                >
                  <span
                    className={`absolute top-[2px] w-4 h-4 rounded-full transition-all duration-300 shadow-md ${
                      hibernate
                        ? 'left-[18px] bg-[#6be1e3] shadow-[0_0_6px_#6be1e3]'
                        : 'left-[2px] bg-[#a4a8c0]'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                id="run-scraper-button"
                type="submit"
                disabled={!canSubmit}
                className="btn-one flex-1 flex items-center justify-center gap-2 py-4 text-xs uppercase tracking-widest font-black disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {isStarting
                  ? <RefreshCcw className="animate-spin" size={15} />
                  : <><Play size={13} className="fill-current" />Ejecutar Scraper</>}
              </button>

              {activeJob && (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isCancelling}
                  className="flex items-center gap-1.5 px-4 py-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs font-black uppercase tracking-wider disabled:opacity-50"
                  title="Cancelar extracción activa"
                >
                  {isCancelling ? <RefreshCcw size={13} className="animate-spin" /> : <StopCircle size={13} />}
                  {!isCancelling && 'Cancelar'}
                </button>
              )}
            </div>
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
                  <div className="text-[10px] text-[#a4a8c0]/60">
                    {activeJob.startedAt ? 'desde inicio real' : 'desde esta sesión'}
                  </div>
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
                { label: 'Leídos', value: vistas, color: '#6be1e3', icon: Eye, sub: 'perfiles analizados' },
                { label: 'Pendientes', value: pendientes, color: '#e4c76a', icon: Clock, sub: 'restantes' },
                { label: 'Leads Extraídos', value: activeJob?.usersFound ?? 0, color: '#e17bd7', icon: Award, sub: 'con email válido' },
                { label: 'Límite', value: maxLimit, color: '#a4a8c0', icon: Users, sub: 'máx. perfiles' },
              ].map(({ label, value, color, icon: Icon, sub }) => (
                <div key={label} className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5">
                  <div className="flex items-center gap-1 text-[9px] font-extrabold text-[#a4a8c0] uppercase tracking-wider mb-1">
                    <Icon size={10} style={{ color }} />{label}
                  </div>
                  <div className="text-lg font-black font-exo" style={{ color }}>{value}</div>
                  <div className="text-[8px] text-[#a4a8c0]/60">{sub}</div>
                </div>
              ))}
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
      {visibleAnalyses.length > 0 && (
        <section className="glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold font-exo flex items-center gap-2 text-[#a4a8c0]">
              <Clock size={14} />Historial de Extracciones
            </h3>
            {historyJobs.length > 0 && (
              <button
                onClick={clearAllHidden}
                className="text-[9px] font-bold text-[#a4a8c0]/50 hover:text-red-400 uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <Trash2 size={10} />Limpiar historial
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {visibleAnalyses.map(a => (
              <div key={a.id} className="bg-black/30 border border-white/5 rounded-xl p-4 space-y-3 hover:border-white/10 transition-colors relative group">
                {/* Hide button */}
                {a.status !== 'processing' && a.status !== 'pending' && (
                  <button
                    onClick={() => hideJob(a.id)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-[#a4a8c0]/40 hover:text-red-400 transition-all"
                    title="Ocultar de historial"
                  >
                    <Trash2 size={11} />
                  </button>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-[#fefeff]">@{a.target}</span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                    a.status === 'completed'  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    a.status === 'processing' ? 'bg-[#6be1e3]/10 text-[#6be1e3] border border-[#6be1e3]/20 animate-pulse' :
                    a.status === 'cancelled'  ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                    (a.status === 'failed' || a.status === 'error') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-white/5 text-[#a4a8c0] border border-white/5'
                  }`}>{a.status}</span>
                </div>

                {/* Extended metrics */}
                <div className="text-[10px] text-[#a4a8c0] grid grid-cols-3 gap-1">
                  <div className="flex flex-col">
                    <span className="text-[8px] text-[#a4a8c0]/50 uppercase">Leídos</span>
                    <span className="font-bold text-[#6be1e3]">{a.usersAnalyzed}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-[#a4a8c0]/50 uppercase">Leads</span>
                    <span className="font-bold text-[#e17bd7]">{a.usersFound}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] text-[#a4a8c0]/50 uppercase">Límite</span>
                    <span className="font-bold text-white">{a.maxFollowers && a.maxFollowers > 0 ? a.maxFollowers : '10k'}</span>
                  </div>
                </div>

                <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      a.status === 'cancelled' ? 'bg-orange-500' :
                      (a.status === 'failed' || a.status === 'error') ? 'bg-red-500' :
                      'bg-gradient-to-r from-[#e17bd7] to-[#6be1e3]'
                    }`}
                    style={{ width: `${a.progress}%` }}
                  />
                </div>

                {a.errorMessage && (
                  <div className="space-y-1.5 pt-1.5 border-t border-white/5">
                    <p className="text-[9px] text-red-400 truncate flex items-center gap-1 font-semibold">
                      <AlertCircle size={10} className="shrink-0" />
                      <span>{a.errorMessage}</span>
                    </p>
                    <button
                      id={`view-error-${a.id}-button`}
                      onClick={() => setSelectedError(a.errorMessage!)}
                      className="text-[8px] font-extrabold uppercase tracking-wider text-[#6be1e3] hover:text-[#6be1e3]/80 transition-colors flex items-center gap-0.5"
                    >
                      Ver Detalle
                    </button>
                  </div>
                )}
                {a.status === 'completed' && (
                  <div className="flex items-center gap-1 text-[9px] text-emerald-400">
                    <CheckCircle size={10} />
                    <span className="font-bold">{a.usersFound} leads guardados · {a.date}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Error Details Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-6 rounded-2xl border-red-500/20 relative overflow-hidden">
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
