'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3, Users, Zap, Target, TrendingUp, Mail, Phone, Clock, Play,
  GitBranch, DollarSign,
} from 'lucide-react';
import type { Lead, Analysis } from '@/lib/types';
import { API_BASE } from '@/lib/types';
import { MOCK_DEALS } from '@/lib/mock-data';

// Treemap-style distribution box
function SourceBox({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div
      className="rounded-xl flex flex-col justify-between p-3 relative overflow-hidden cursor-default transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: `${color}15`,
        border: `1px solid ${color}30`,
        flexGrow: pct,
        minWidth: '80px',
        minHeight: '60px',
      }}
    >
      <div className="absolute inset-0 opacity-5" style={{ backgroundColor: color }} />
      <div className="text-[8px] font-extrabold uppercase tracking-wider truncate" style={{ color }}>{label}</div>
      <div>
        <div className="text-lg font-black font-exo text-white">{count}</div>
        <div className="text-[9px] font-bold" style={{ color }}>{pct}%</div>
      </div>
    </div>
  );
}

const PALETTE = ['#e17bd7', '#6be1e3', '#e4c76a', '#b673df', '#34d399', '#f87171', '#60a5fa'];

export default function DashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  const parseLeads = (res: unknown): Lead[] => {
    if (Array.isArray(res)) return res;
    if (res && typeof res === 'object' && 'data' in res) return (res as { data: Lead[] }).data || [];
    return [];
  };

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/leads?limit=500`).then(r => r.json()),
      fetch(`${API_BASE}/scraping/status/all`).then(r => r.json()),
    ]).then(([l, a]) => {
      setLeads(parseLeads(l));
      setAnalyses(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => setLoading(false));

    const interval = setInterval(() => {
      Promise.all([
        fetch(`${API_BASE}/leads?limit=500`).then(r => r.json()),
        fetch(`${API_BASE}/scraping/status/all`).then(r => r.json()),
      ]).then(([l, a]) => {
        setLeads(parseLeads(l));
        setAnalyses(Array.isArray(a) ? a : []);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const leadsWithPhone = leads.filter(l => l.phone).length;
  const uniqueSources = Array.from(new Set(leads.map(l => l.sourceAccount).filter(Boolean)));
  const completedJobs = analyses.filter(a => a.status === 'completed').length;
  const activeJob = analyses.find(a => a.status === 'processing' || a.status === 'pending');

  // Source distribution
  const sourceCounts: Record<string, number> = {};
  leads.forEach(l => {
    if (l.sourceAccount) sourceCounts[l.sourceAccount] = (sourceCounts[l.sourceAccount] || 0) + 1;
  });
  const topSources = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).slice(0, 7);

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  leads.forEach(l => { if (l.category) categoryCounts[l.category] = (categoryCounts[l.category] || 0) + 1; });
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCatCount = topCategories[0]?.[1] || 1;

  // Quality
  const highQuality = leads.filter(l => l.qualityScore >= 70).length;
  const midQuality  = leads.filter(l => l.qualityScore >= 40 && l.qualityScore < 70).length;
  const lowQuality  = leads.filter(l => l.qualityScore < 40).length;

  // Pipeline mock metrics
  const activeDeals = MOCK_DEALS.filter(d => d.stage !== 'ganado' && d.stage !== 'perdido');
  const wonDeals    = MOCK_DEALS.filter(d => d.stage === 'ganado');
  const pipelineValue = activeDeals.reduce((s, d) => s + d.amount, 0);
  const wonValue      = wonDeals.reduce((s, d) => s + d.amount, 0);
  const winRate       = MOCK_DEALS.length ? Math.round((wonDeals.length / MOCK_DEALS.length) * 100) : 0;

  const stats = [
    { label: 'Leads Totales',  value: leads.length,           icon: Users,    color: '#e17bd7', glow: 'rgba(225,123,215,0.3)',  sub: 'solo con email' },
    { label: 'Con Teléfono',   value: leadsWithPhone,          icon: Phone,    color: '#6be1e3', glow: 'rgba(107,225,227,0.3)',  sub: 'contacto directo' },
    { label: 'Extracciones',   value: completedJobs,           icon: Zap,      color: '#e4c76a', glow: 'rgba(228,199,106,0.3)',  sub: 'completadas' },
    { label: 'Fuentes IG',     value: uniqueSources.length,    icon: Target,   color: '#a4a8c0', glow: 'rgba(164,168,192,0.3)',  sub: 'cuentas analizadas' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#e17bd7]/5 blur-[150px] rounded-full -mr-60 -mt-60 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-exo tracking-tight flex items-center gap-2">
            <BarChart3 size={22} className="text-[#e17bd7]" />
            Dashboard
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">Resumen general de tu base de prospectos y pipeline.</p>
        </div>
        {activeJob && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#6be1e3]/10 border border-[#6be1e3]/20 animate-pulse">
            <span className="w-1.5 h-1.5 bg-[#6be1e3] rounded-full" />
            <span className="text-[9px] font-extrabold tracking-widest text-[#6be1e3] uppercase">Extracción activa</span>
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="glass-card p-5 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">{s.label}</span>
              <s.icon size={15} style={{ color: s.color }} />
            </div>
            <div className="text-3xl font-black font-exo" style={{ color: s.color, textShadow: `0 0 20px ${s.glow}` }}>
              {loading ? '—' : s.value}
            </div>
            <div className="text-[10px] text-[#a4a8c0]/60">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline summary (admin overview) */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2">
            <GitBranch size={15} className="text-[#e17bd7]" />
            Resumen del Pipeline de Ventas
          </h3>
          <Link href="/pipeline" className="text-[9px] font-bold text-[#a4a8c0]/50 hover:text-[#e17bd7] uppercase tracking-wider transition-colors">
            Ver kanban →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Deals activos',  value: activeDeals.length,                        color: '#e17bd7', icon: GitBranch  },
            { label: 'Pipeline',       value: `$${(pipelineValue/1000).toFixed(0)}k`,    color: '#6be1e3', icon: TrendingUp },
            { label: 'Ganado',         value: `$${(wonValue/1000).toFixed(0)}k`,         color: '#34d399', icon: DollarSign },
            { label: 'Win Rate',       value: `${winRate}%`,                             color: '#e4c76a', icon: Target     },
          ].map(s => (
            <div key={s.label} className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                <s.icon size={10} style={{ color: s.color }} />{s.label}
              </div>
              <div className="text-xl font-black font-exo" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
        {/* Pipeline stage bars */}
        <div className="grid grid-cols-7 gap-1 pt-1">
          {['Nuevo','Contactado','Interesado','Propuesta','Negoc.','Ganado','Perdido'].map((stage, i) => {
            const stageKeys = ['nuevo','contactado','interesado','propuesta','negociacion','ganado','perdido'];
            const cnt = MOCK_DEALS.filter(d => d.stage === stageKeys[i]).length;
            const max = Math.max(...stageKeys.map(k => MOCK_DEALS.filter(d => d.stage === k).length), 1);
            const colors = ['#6be1e3','#a4a8c0','#e4c76a','#e17bd7','#b673df','#34d399','#ef4444'];
            return (
              <div key={stage} className="flex flex-col items-center gap-1">
                <div className="w-full bg-black/40 rounded-full overflow-hidden" style={{ height: '40px' }}>
                  <div
                    className="rounded-full transition-all duration-700"
                    style={{
                      height: `${(cnt / max) * 100}%`,
                      backgroundColor: colors[i],
                      boxShadow: `0 0 8px ${colors[i]}`,
                      marginTop: `${((1 - cnt/max) * 100)}%`,
                    }}
                  />
                </div>
                <div className="text-[8px] text-center font-bold text-[#a4a8c0]/60 leading-tight">{stage}</div>
                <div className="text-[9px] font-black" style={{ color: colors[i] }}>{cnt}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Source distribution (treemap) */}
        <div className="glass-card p-5 rounded-2xl space-y-4 lg:col-span-2">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2">
            <Target size={15} className="text-[#e17bd7]" />
            Distribución de Fuentes
          </h3>
          {topSources.length === 0 ? (
            <div className="text-[#a4a8c0]/40 text-xs text-center py-8">Sin datos aún</div>
          ) : (
            <div className="flex flex-wrap gap-2" style={{ minHeight: '80px' }}>
              {topSources.map(([src, cnt], i) => (
                <SourceBox
                  key={src}
                  label={`@${src}`}
                  count={cnt}
                  total={leads.length}
                  color={PALETTE[i % PALETTE.length]}
                />
              ))}
            </div>
          )}
          <div className="text-[9px] text-[#a4a8c0]/40 pt-1 border-t border-white/5">
            {leads.length} leads totales distribuidos en {uniqueSources.length} fuentes de Instagram
          </div>
        </div>

        {/* Quality Breakdown */}
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2">
            <TrendingUp size={15} className="text-[#e17bd7]" />
            Calidad de Leads
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Alta  (≥70)',   count: highQuality, color: '#34d399' },
              { label: 'Media (40–69)', count: midQuality,  color: '#e4c76a' },
              { label: 'Baja  (<40)',   count: lowQuality,  color: '#ef4444' },
            ].map(({ label, count, color }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-[#a4a8c0]">{label}</span>
                  <span style={{ color }}>{count}</span>
                </div>
                <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${leads.length ? (count / leads.length) * 100 : 0}%`,
                      backgroundColor: color,
                      boxShadow: `0 0 8px ${color}`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-white/5 text-[10px] text-[#a4a8c0]/60">
            {leadsWithPhone} leads también tienen teléfono
          </div>
        </div>
      </div>

      {/* Top Categories + Recent Jobs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="glass-card p-5 rounded-2xl space-y-4 lg:col-span-2">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2">
            <Target size={15} className="text-[#6be1e3]" />
            Top Categorías de Negocio
          </h3>
          {topCategories.length === 0 ? (
            <div className="text-[#a4a8c0]/40 text-xs text-center py-6">Sin datos aún</div>
          ) : (
            <div className="space-y-2.5">
              {topCategories.map(([cat, count], i) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-[#fefeff] truncate max-w-[200px]">{cat}</span>
                    <span style={{ color: PALETTE[i % PALETTE.length] }}>{count}</span>
                  </div>
                  <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${(count / maxCatCount) * 100}%`,
                        backgroundColor: PALETTE[i % PALETTE.length],
                        boxShadow: `0 0 6px ${PALETTE[i % PALETTE.length]}`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Jobs */}
        <div className="glass-card p-5 rounded-2xl space-y-4 flex flex-col">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2">
            <Clock size={15} className="text-[#e4c76a]" />
            Últimas Extracciones
          </h3>
          <div className="flex-1 space-y-2">
            {analyses.length === 0 ? (
              <div className="text-[#a4a8c0]/40 text-xs text-center py-6">Sin extracciones aún</div>
            ) : (
              analyses.slice(0, 5).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <div className="text-xs font-extrabold text-[#fefeff]">@{a.target}</div>
                    <div className="text-[9px] text-[#a4a8c0]">{a.usersFound} leads · {a.usersAnalyzed} leídos</div>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                    a.status === 'completed'  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    a.status === 'processing' ? 'bg-[#6be1e3]/10 text-[#6be1e3] border border-[#6be1e3]/20' :
                    a.status === 'failed'     ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                                              'bg-white/5 text-[#a4a8c0] border border-white/5'
                  }`}>{a.status}</span>
                </div>
              ))
            )}
          </div>
          <Link
            href="/extraccion"
            className="btn-one w-full flex items-center justify-center gap-2 py-3 text-[10px] uppercase tracking-widest font-black mt-auto"
          >
            <Play size={12} className="fill-current" />
            Nueva Extracción
          </Link>
        </div>
      </div>

      {/* Footer note */}
      <div className="glass-card p-4 rounded-2xl flex items-center gap-3 border-[#6be1e3]/10">
        <Mail size={16} className="text-[#6be1e3] shrink-0" />
        <div className="text-[11px] text-[#a4a8c0]">
          El scraper solo guarda prospectos con email verificado.{' '}
          <span className="text-[#fefeff] font-bold">{leads.length} leads accionables</span> en tu base de datos.
        </div>
      </div>
    </div>
  );
}
