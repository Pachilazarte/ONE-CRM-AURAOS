'use client';

import { useState, useEffect } from 'react';
import { GitBranch, Plus, Filter, LayoutGrid, List } from 'lucide-react';
import type { Deal, DealStage, MockSession } from '@/lib/types';
import { DEAL_STAGES } from '@/lib/types';
import { MOCK_DEALS } from '@/lib/mock-data';

const STAGE_COLS: DealStage[] = ['nuevo','contactado','respuestas','recontactos','propuesta','ganado','perdido'];

function ProbabilityBar({ value }: { value: number }) {
  const color = value >= 70 ? '#34d399' : value >= 40 ? '#e4c76a' : '#a4a8c0';
  return (
    <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden mt-1.5">
      <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
    </div>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  const stage = DEAL_STAGES.find(s => s.key === deal.stage)!;
  return (
    <div className="glass-card p-4 rounded-xl space-y-3 cursor-grab active:cursor-grabbing border-white/5 hover:border-white/15 transition-all group">
      <div className="flex items-start justify-between gap-2">
        <div className="font-extrabold text-xs text-[#fefeff] group-hover:text-[#e17bd7] transition-colors leading-tight">
          {deal.contactName}
        </div>
        <span className="text-[9px] font-black text-[#a4a8c0]/60 shrink-0">{deal.expectedClose.substring(5)}</span>
      </div>
      <div className="text-lg font-black font-exo text-[#fefeff]">
        ${deal.amount.toLocaleString('es-AR')}
      </div>
      <div>
        <div className="flex justify-between text-[9px] text-[#a4a8c0]/70">
          <span>{deal.assignedTo.split(' ')[0]}</span>
          <span style={{ color: stage.color }}>{deal.probability}%</span>
        </div>
        <ProbabilityBar value={deal.probability} />
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const [deals] = useState<Deal[]>(MOCK_DEALS);
  const [filter, setFilter] = useState('');
  const [user, setUser] = useState<MockSession | null>(null);

  useEffect(() => {
    const cached = localStorage.getItem('crm_session');
    if (cached) setUser(JSON.parse(cached));
  }, []);

  // For Admin: filter by selected seller
  // For Vendedor: filter by themselves!
  const filtered = deals.filter(d => {
    if (user?.role === 'vendedor') {
      // simulate exact match or just return all for demo if name doesn't match
      return d.assignedTo.toLowerCase().includes(user.name.split(' ')[0].toLowerCase()) || true; 
      // Note: for this demo we just show all if seller doesn't match perfectly so the board isn't empty
    }
    if (filter) {
      return d.assignedTo.toLowerCase().includes(filter.toLowerCase());
    }
    return true;
  });

  const byStage = (stage: DealStage) => filtered.filter(d => d.stage === stage);

  const totalActive = filtered.filter(d => d.stage !== 'ganado' && d.stage !== 'perdido');
  const totalValue  = totalActive.reduce((s, d) => s + d.amount, 0);
  const wonValue    = filtered.filter(d => d.stage === 'ganado').reduce((s, d) => s + d.amount, 0);
  const winRate     = filtered.length ? Math.round((filtered.filter(d => d.stage === 'ganado').length / filtered.length) * 100) : 0;

  const isAdmin = user?.role === 'admin';

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 pb-4 space-y-4 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
              <GitBranch size={22} className="text-[#e17bd7]" />
              {isAdmin ? 'Rendimiento Vendedores' : 'Mi Pipeline de Ventas'}
            </h1>
            <p className="text-xs text-[#a4a8c0] mt-0.5">
              {totalActive.length} deals activos · ${totalValue.toLocaleString('es-AR')} en juego
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="relative">
                <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a4a8c0]/50" />
                <select value={filter} onChange={e => setFilter(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl py-2 pl-8 pr-4 text-[10px] font-bold text-[#fefeff] focus:outline-none focus:border-[#e17bd7] cursor-pointer uppercase tracking-wider appearance-none">
                  <option value="">Todos los vendedores</option>
                  <option value="Carlos">Carlos Méndez</option>
                  <option value="Ana">Ana Rodríguez</option>
                </select>
              </div>
            )}
            {!isAdmin && (
              <button className="btn-one flex items-center gap-1.5 py-2 px-4 text-[10px] uppercase tracking-wider font-black">
                <Plus size={13} />Nuevo Deal
              </button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Deals activos', value: totalActive.length,                  color: '#e17bd7' },
            { label: 'Valor pipeline',value: `$${(totalValue/1000).toFixed(0)}K`, color: '#6be1e3' },
            { label: 'Ganado',         value: `$${(wonValue/1000).toFixed(0)}K`,  color: '#34d399' },
            { label: 'Win Rate',       value: `${winRate}%`,                       color: '#e4c76a' },
          ].map(s => (
            <div key={s.label} className="glass-card px-4 py-3 rounded-xl flex items-center justify-between">
              <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">{s.label}</span>
              <span className="text-base font-black font-exo" style={{ color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {isAdmin ? (
        /* ADMIN TABLE VIEW */
        <div className="flex-1 overflow-auto px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="glass-card rounded-2xl overflow-hidden border border-white/5">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#a4a8c0]">Oportunidad / Contacto</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#a4a8c0]">Vendedor</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#a4a8c0]">Etapa</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#a4a8c0] text-right">Valor Estimado</th>
                  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-[#a4a8c0] text-center">Probabilidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filtered.map(deal => {
                  const stage = DEAL_STAGES.find(s => s.key === deal.stage)!;
                  return (
                    <tr key={deal.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4">
                        <div className="font-bold text-white group-hover:text-[#e17bd7] transition-colors">{deal.contactName}</div>
                        <div className="text-xs text-[#a4a8c0] mt-0.5">Cierre: {deal.expectedClose}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white">
                            {deal.assignedTo.charAt(0)}
                          </div>
                          <span className="text-[#a4a8c0] text-xs font-bold">{deal.assignedTo}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border border-white/10 bg-black/20" style={{ color: stage.color }}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="p-4 text-right font-exo font-bold text-white">
                        ${deal.amount.toLocaleString('es-AR')}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center gap-2 justify-center">
                          <span className="text-xs font-bold" style={{ color: stage.color }}>{deal.probability}%</span>
                          <div className="w-16"><ProbabilityBar value={deal.probability} /></div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VENDEDOR KANBAN BOARD */
        <div className="flex-1 overflow-x-auto px-6 pb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex gap-4 h-full" style={{ minWidth: `${STAGE_COLS.length * 220}px` }}>
            {STAGE_COLS.map(stageKey => {
              const stageInfo  = DEAL_STAGES.find(s => s.key === stageKey)!;
              const stageDeals = byStage(stageKey);
              const stageTotal = stageDeals.reduce((s, d) => s + d.amount, 0);

              return (
                <div key={stageKey} className="flex flex-col" style={{ width: 210, minWidth: 210 }}>
                  <div className="mb-3 px-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: stageInfo.color }}>
                        {stageInfo.label}
                      </span>
                      <span className="text-[9px] font-black bg-white/5 border border-white/5 px-1.5 py-0.5 rounded text-[#a4a8c0]">
                        {stageDeals.length}
                      </span>
                    </div>
                    {stageTotal > 0 && (
                      <div className="text-[9px] text-[#a4a8c0]/60 font-bold">${stageTotal.toLocaleString('es-AR')}</div>
                    )}
                    <div className="h-[2px] rounded-full mt-2" style={{ backgroundColor: stageInfo.color, boxShadow: `0 0 8px ${stageInfo.color}` }} />
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {stageDeals.map(d => <DealCard key={d.id} deal={d} />)}
                    {stageDeals.length === 0 && (
                      <div className="border border-dashed border-white/10 rounded-xl p-4 text-center text-[#a4a8c0]/30 text-[10px]">
                        Sin deals
                      </div>
                    )}
                  </div>

                  <button className="mt-3 flex items-center gap-1 px-3 py-2 rounded-xl text-[10px] font-bold text-[#a4a8c0]/40 hover:text-[#a4a8c0] hover:bg-white/5 transition-all border border-dashed border-white/10 hover:border-white/20 w-full">
                    <Plus size={12} />Agregar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
