'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Target, Play, Users, Mail, Send, X, ChevronDown, RefreshCw, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import type { Lead } from '@/lib/types';
import { API_BASE } from '@/lib/types';

interface Campaign {
  id: string;
  name: string;
  subject: string;
  total: number;
  sent: number;
  failed: number;
  status: 'pending' | 'sending' | 'done' | 'error';
  createdAt: string;
  finishedAt?: string;
}

const STATUS_META = {
  pending:  { label: 'Pendiente', textCls: 'text-[#a4a8c0]', bg: 'bg-white/5',          icon: Clock },
  sending:  { label: 'Enviando',  textCls: 'text-[#6be1e3]', bg: 'bg-[#6be1e3]/10',     icon: Loader2 },
  done:     { label: 'Enviado',   textCls: 'text-emerald-400', bg: 'bg-emerald-500/10',  icon: CheckCircle },
  error:    { label: 'Error',     textCls: 'text-red-400',    bg: 'bg-red-500/10',       icon: AlertCircle },
};

export default function CampanasPage() {
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showModal, setShowModal]     = useState(false);
  const [sending, setSending]         = useState(false);
  const [sendError, setSendError]     = useState('');

  // Form state
  const [formName, setFormName]       = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody]       = useState('');
  const [formSource, setFormSource]   = useState('__all__');

  const fetchAll = useCallback(async () => {
    try {
      const [cRes, lRes] = await Promise.all([
        fetch(`${API_BASE}/campaigns`),
        fetch(`${API_BASE}/leads?limit=1000`),
      ]);
      const cData = await cRes.json();
      const lData = await lRes.json();
      setCampaigns(Array.isArray(cData) ? cData : []);
      const leadsArr = Array.isArray(lData) ? lData : (lData?.data ?? []);
      setLeads(leadsArr.filter((l: Lead) => l.email));
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-refresh while any campaign is sending
  useEffect(() => {
    const hasSending = campaigns.some(c => c.status === 'sending' || c.status === 'pending');
    if (!hasSending) return;
    const t = setInterval(fetchAll, 4000);
    return () => clearInterval(t);
  }, [campaigns, fetchAll]);

  const sources = Array.from(new Set(leads.map(l => l.sourceAccount).filter(Boolean)));

  const targetLeads = formSource === '__all__'
    ? leads
    : leads.filter(l => l.sourceAccount === formSource);

  const handleSend = async () => {
    if (!formSubject.trim() || !formBody.trim()) return;
    if (targetLeads.length === 0) { setSendError('No hay leads para este filtro.'); return; }
    setSending(true);
    setSendError('');
    try {
      const contacts = targetLeads.map(l => ({ email: l.email!, name: l.fullname || l.username }));
      const res = await fetch(`${API_BASE}/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName || undefined, subject: formSubject, html: formBody, contacts }),
      });
      const data = await res.json();
      if (!res.ok) { setSendError(data.error || 'Error al crear campaña.'); setSending(false); return; }
      setShowModal(false);
      resetForm();
      fetchAll();
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Error de red.');
    }
    setSending(false);
  };

  const resetForm = () => {
    setFormName(''); setFormSubject(''); setFormBody('');
    setFormSource('__all__'); setSendError('');
  };

  const totalSent    = campaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
  const totalLeadsDB = leads.length;
  const activeCamps  = campaigns.filter(c => c.status === 'sending' || c.status === 'pending').length;

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-8 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#e17bd7]/4 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Target size={22} className="text-[#e17bd7]" />Campañas de Email
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">Enviá emails masivos a tus leads captados.</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label="Actualizar" onClick={fetchAll} className="p-2 rounded-xl border border-white/10 text-[#a4a8c0] hover:text-[#fefeff] hover:border-white/20 transition-all">
            <RefreshCw size={14} />
          </button>
          <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
            className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black">
            <Mail size={12} />Nueva Campaña
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5 rounded-2xl text-center space-y-1">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Campañas</div>
          <div className="text-2xl font-black font-exo text-[#e17bd7]">{loading ? '—' : campaigns.length}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl text-center space-y-1">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Emails Enviados</div>
          <div className="text-2xl font-black font-exo text-[#6be1e3]">{loading ? '—' : totalSent}</div>
        </div>
        <div className="glass-card p-5 rounded-2xl text-center space-y-1">
          <div className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Leads Disponibles</div>
          <div className="text-2xl font-black font-exo text-[#e4c76a]">{loading ? '—' : totalLeadsDB}</div>
        </div>
      </div>

      {/* Campaigns list */}
      {!loading && campaigns.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center space-y-4">
          <Mail size={36} className="mx-auto text-[#a4a8c0]/30" />
          <p className="text-sm text-[#a4a8c0]">Todavía no enviaste ninguna campaña.</p>
          <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
            className="btn-one inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-widest font-black">
            <Send size={13} />Crear primera campaña
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <h2 className="text-xs font-extrabold uppercase tracking-widest text-[#a4a8c0]">Historial</h2>
          {campaigns.map(c => {
            const meta  = STATUS_META[c.status] ?? STATUS_META.pending;
            const Icon  = meta.icon;
            const pct   = c.total > 0 ? Math.round(((c.sent + c.failed) / c.total) * 100) : 0;
            return (
              <div key={c.id} className="glass-card p-5 rounded-2xl flex items-center gap-5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-extrabold text-[#fefeff] truncate">{c.name || c.subject}</span>
                    <span className={`flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded ${meta.bg} ${meta.textCls} border border-white/5`}>
                      <Icon size={9} className={c.status === 'sending' ? 'animate-spin' : ''} />
                      {meta.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a4a8c0]">
                    Asunto: <span className="text-[#fefeff]/70">{c.subject}</span>
                    {' · '}{new Date(c.createdAt).toLocaleDateString('es-AR')}
                  </div>
                  {c.total > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <div className="flex justify-between text-[9px] text-[#a4a8c0]">
                        <span>{c.sent} enviados · {c.failed} fallidos · {c.total} total</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500 bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]"
                          style={{ width: `${Math.round((c.sent / c.total) * 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xl font-black font-exo text-[#e17bd7]">{c.total}</div>
                  <div className="text-[9px] text-[#a4a8c0] uppercase tracking-wider">destinatarios</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active badge */}
      {activeCamps > 0 && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#6be1e3]/10 border border-[#6be1e3]/30 text-[#6be1e3] text-xs font-extrabold shadow-lg animate-pulse">
          <Loader2 size={12} className="animate-spin" />
          {activeCamps} campaña{activeCamps > 1 ? 's' : ''} enviando...
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl glass-card rounded-2xl p-6 space-y-5 border border-white/10 shadow-2xl">

            {/* Modal header */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold font-exo flex items-center gap-2">
                <Mail size={16} className="text-[#e17bd7]" />Nueva Campaña de Email
              </h2>
              <button type="button" aria-label="Cerrar" onClick={() => setShowModal(false)} className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Campaign name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Nombre (opcional)</label>
              <input value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Ej: Campaña Mayo 2026"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all" />
            </div>

            {/* Target leads */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                Destinatarios
                <span className="ml-2 font-normal normal-case text-[#6be1e3]">{targetLeads.length} leads</span>
              </label>
              <div className="relative">
                <select aria-label="Filtrar destinatarios por fuente" value={formSource} onChange={e => setFormSource(e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all pr-8">
                  <option value="__all__">Todos los leads ({leads.length})</option>
                  {sources.map(s => (
                    <option key={s} value={s}>
                      @{s} ({leads.filter(l => l.sourceAccount === s).length} leads)
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#a4a8c0] pointer-events-none" />
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Asunto *</label>
              <input value={formSubject} onChange={e => setFormSubject(e.target.value)}
                placeholder="Ej: Te contactamos desde ONE Consulting"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all" />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                Cuerpo del email *
                <span className="ml-2 font-normal normal-case text-[#a4a8c0]/60">Podés usar {'{{name}}'} para personalizar</span>
              </label>
              <textarea value={formBody} onChange={e => setFormBody(e.target.value)} rows={7}
                placeholder={`<p>Hola {{name}},</p>\n<p>Te escribimos desde ONE Consulting...</p>`}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-mono resize-none focus:outline-none focus:border-[#e17bd7] transition-all" />
            </div>

            {sendError && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle size={13} />
                {sendError}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-[#a4a8c0]/60">
                Se enviará desde: <span className="text-[#fefeff]/50 font-mono">one@escencialconsultora.com</span>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0] hover:text-[#fefeff] transition-colors">
                  Cancelar
                </button>
                <button type="button" onClick={handleSend}
                  disabled={sending || !formSubject.trim() || !formBody.trim() || targetLeads.length === 0}
                  className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black disabled:opacity-30">
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sending ? 'Enviando...' : `Enviar a ${targetLeads.length} leads`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
