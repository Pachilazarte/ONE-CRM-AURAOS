'use client';

import { useState } from 'react';
import { Users, Search, Plus, Mail, Phone, ExternalLink, TrendingUp } from 'lucide-react';
import type { CRMContact, ContactStatus } from '@/lib/types';
import { MOCK_CONTACTS } from '@/lib/mock-data';

const STATUS_LABEL: Record<ContactStatus, { label: string; color: string; bg: string }> = {
  cold: { label: 'Frío',    color: '#6be1e3', bg: 'bg-[#6be1e3]/10 border-[#6be1e3]/20' },
  warm: { label: 'Tibio',   color: '#e4c76a', bg: 'bg-[#e4c76a]/10 border-[#e4c76a]/20' },
  hot:  { label: 'Caliente',color: '#e17bd7', bg: 'bg-[#e17bd7]/10 border-[#e17bd7]/20' },
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 40 ? '#e4c76a' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black border"
        style={{ color, borderColor: color + '33', backgroundColor: color + '11' }}>
        {score}
      </div>
      <div className="w-20 bg-black/40 h-1.5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function ContactosPage() {
  const [contacts]       = useState<CRMContact[]>(MOCK_CONTACTS);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState<ContactStatus | ''>('');

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase();
    return (!statusFilter || c.status === statusFilter) &&
      (!q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.company || '').toLowerCase().includes(q));
  });

  const counts = { hot: contacts.filter(c=>c.status==='hot').length, warm: contacts.filter(c=>c.status==='warm').length, cold: contacts.filter(c=>c.status==='cold').length };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#6be1e3]/4 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Users size={22} className="text-[#e17bd7]" />Contactos CRM
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">{contacts.length} contactos · importados desde Prospectos y enriquecidos manualmente</p>
        </div>
        <button className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black">
          <Plus size={13} />Nuevo Contacto
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-3 gap-4">
        {(['hot','warm','cold'] as ContactStatus[]).map(s => {
          const info = STATUS_LABEL[s];
          return (
            <button key={s} onClick={() => setStatus(statusFilter === s ? '' : s)}
              className={`glass-card p-4 rounded-2xl flex items-center justify-between transition-all ${statusFilter === s ? 'border-[#e17bd7]/30' : 'hover:border-white/15'}`}>
              <div>
                <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">{info.label}</div>
                <div className="text-2xl font-black font-exo mt-0.5" style={{ color: info.color }}>{counts[s]}</div>
              </div>
              <TrendingUp size={18} style={{ color: info.color }} />
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-xl flex items-center gap-4 border-white/5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a4a8c0]/50" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, email o empresa..."
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-9 pr-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all" />
        </div>
        {statusFilter && (
          <button onClick={() => setStatus('')} className="text-[10px] font-bold text-[#a4a8c0] hover:text-[#fefeff] px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
            Limpiar filtro ✕
          </button>
        )}
        <span className="text-[10px] text-[#a4a8c0]/50 ml-auto">{filtered.length} resultado{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-2xl border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]/50">
                <th className="px-4 py-3.5">Contacto</th>
                <th className="px-4 py-3.5">Empresa</th>
                <th className="px-4 py-3.5">Email / Tel</th>
                <th className="px-4 py-3.5">Estado</th>
                <th className="px-4 py-3.5">Lead Score</th>
                <th className="px-4 py-3.5">Asignado a</th>
                <th className="px-4 py-3.5">Última actividad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map(c => {
                const st = STATUS_LABEL[c.status];
                return (
                  <tr key={c.id} className="hover:bg-white/[0.01] transition-all group text-xs">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#e17bd7]/20 to-[#6be1e3]/20 flex items-center justify-center text-[10px] font-black text-[#fefeff] border border-white/5 shrink-0">
                          {c.name.substring(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-[#fefeff] group-hover:text-[#e17bd7] transition-colors">{c.name}</div>
                          <div className="text-[9px] text-[#a4a8c0]/60 mt-0.5">desde @{c.source}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#a4a8c0] font-semibold">{c.company || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-[#6be1e3] font-bold hover:underline text-[10px]">
                          <Mail size={10} />{c.email}
                        </a>
                        {c.phone && <div className="flex items-center gap-1 text-[#a4a8c0] text-[10px]"><Phone size={10} />{c.phone}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${st.bg}`} style={{ color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3"><ScoreBadge score={c.leadScore} /></td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold text-[#a4a8c0]">{c.assignedTo.split(' ')[0]}</span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-[#a4a8c0]/60">{c.lastActivity}</td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-6 py-16 text-center text-[#a4a8c0]/40 text-xs">Sin contactos bajo el filtro seleccionado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
