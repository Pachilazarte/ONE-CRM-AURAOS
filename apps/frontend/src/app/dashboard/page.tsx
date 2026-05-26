'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BarChart3, Users, Zap, Target, TrendingUp, Mail, Phone, Clock, Play } from 'lucide-react';
import type { Lead, Analysis } from '@/lib/types';
import { API_BASE } from '@/lib/types';

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
      fetch(`${API_BASE}/leads?limit=200`).then(r => r.json()),
      fetch(`${API_BASE}/scraping/status/all`).then(r => r.json()),
    ]).then(([l, a]) => {
      setLeads(parseLeads(l));
      setAnalyses(Array.isArray(a) ? a : []);
      setLoading(false);
    }).catch(() => setLoading(false));

    const interval = setInterval(() => {
      Promise.all([
        fetch(`${API_BASE}/leads?limit=200`).then(r => r.json()),
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

  // Top categories
  const categoryCounts: Record<string, number> = {};
  leads.forEach(l => { if (l.category) categoryCounts[l.category] = (categoryCounts[l.category] || 0) + 1; });
  const topCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCatCount = topCategories[0]?.[1] || 1;

  // Quality breakdown
  const highQuality = leads.filter(l => l.qualityScore >= 70).length;
  const midQuality  = leads.filter(l => l.qualityScore >= 40 && l.qualityScore < 70).length;
  const lowQuality  = leads.filter(l => l.qualityScore < 40).length;

  const stats = [
    { label: 'Leads Totales',  value: leads.length,           icon: Users,    color: '#e17bd7', glow: 'rgba(225,123,215,0.3)',  sub: 'solo con email' },
    { label: 'Con Teléfono',   value: leadsWithPhone,          icon: Phone,    color: '#6be1e3', glow: 'rgba(107,225,227,0.3)',  sub: 'contacto directo' },
    { label: 'Extracciones',   value: completedJobs,           icon: Zap,      color: '#e4c76a', glow: 'rgba(228,199,106,0.3)',  sub: 'completadas' },
    { label: 'Fuentes IG',     value: uniqueSources.length,    icon: Target,   color: '#a4a8c0', glow: 'rgba(164,168,192,0.3)',  sub: 'cuentas analizadas' },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8 relative">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#e17bd7]/5 blur-[150px] rounded-full -mr-60 -mt-60 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-exo tracking-tight flex items-center gap-2">
            <BarChart3 size={22} className="text-[#e17bd7]" />
            Dashboard
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">Resumen general de tu base de prospectos.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        {/* Top Categories */}
        <div className="glass-card p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-extrabold font-exo flex items-center gap-2">
            <Target size={15} className="text-[#6be1e3]" />
            Top Categorías
          </h3>
          {topCategories.length === 0 ? (
            <div className="text-[#a4a8c0]/40 text-xs text-center py-6">Sin datos aún</div>
          ) : (
            <div className="space-y-2.5">
              {topCategories.map(([cat, count]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-[#fefeff] truncate max-w-[150px]">{cat}</span>
                    <span className="text-[#6be1e3]">{count}</span>
                  </div>
                  <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#6be1e3] transition-all duration-700"
                      style={{ width: `${(count / maxCatCount) * 100}%`, boxShadow: '0 0 6px #6be1e3' }}
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
              analyses.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <div className="text-xs font-extrabold text-[#fefeff]">@{a.target}</div>
                    <div className="text-[9px] text-[#a4a8c0]">{a.usersFound} leads · {a.date}</div>
                  </div>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                    a.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
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

      {/* Email stats note */}
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
