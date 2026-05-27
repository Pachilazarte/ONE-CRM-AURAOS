'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Target, Play, Users, Mail, Send, X, ChevronDown, RefreshCw, CheckCircle, AlertCircle, Clock, Loader2, Bold, Italic, Underline, Strikethrough, Link as LinkIcon, List, Image as ImageIcon, Wand2, FileText, Bot, Type } from 'lucide-react';
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

const SENDER_ACCOUNTS = [
  { id: '1', name: 'Nico Roca', email: 'nico.roca@nico-roca.com', limit: '25/day' },
  { id: '2', name: 'Peter Palmer', email: 'peter@citroflex.com', limit: '25/day' },
  { id: '3', name: 'Peter Palmer', email: 'peter@mailerfind.info', limit: '32/day' },
  { id: '4', name: 'Testings', email: 'testings@mailerfind.com', limit: '25/day' },
];

const PRESET_TEMPLATES = [
  { label: 'Contacto Inicial', html: '<p>Hola {{first_name}},</p><p>Estuve viendo el perfil de {{username}} y me pareció muy interesante lo que están haciendo.</p><p>Nos especializamos en escalar operaciones como la de ustedes. ¿Tendrías 5 minutos la semana que viene para charlar?</p>' },
  { label: 'Propuesta Directa', html: '<p>Qué tal {{first_name}},</p><p>He preparado un archivo (.csv) de clientes potenciales para tu proyecto {{website}}.</p><p>¿Te parece si te lo mando?</p><p>Sé que te llegan muchas propuestas, así que quería pedirte permiso antes de enviarte nada.</p>' },
  { label: 'Seguimiento', html: '<p>Hola {{first_name}},</p><p>Te escribí hace unos días sobre {{website}}. Entiendo que estás ocupado, solo quería reflotar este email por si te resulta de interés.</p><p>Saludos!</p>' },
];

const AI_TONES = ['Corporativo', 'Humano', 'Persuasivo', 'Breve', 'Urgente'];

export default function CampanasPage() {
  const [campaigns, setCampaigns]     = useState<Campaign[]>([]);
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [loading, setLoading]         = useState(true);
  
  // Navigation State
  const [isCreating, setIsCreating]   = useState(false);
  
  const [sending, setSending]         = useState(false);
  const [sendError, setSendError]     = useState('');

  // Form state
  const [formName, setFormName]       = useState('');
  const [formSubject, setFormSubject] = useState('');
  const [formBody, setFormBody]       = useState('');
  const [formSource, setFormSource]   = useState('__all__');
  const [sourceType, setSourceType]   = useState<'analisis'|'lista'>('analisis');
  const [selectedSenders, setSelectedSenders] = useState<string[]>(['1']); // Select first mock sender by default

  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiTone, setAiTone] = useState(AI_TONES[1]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiOpen, setAiOpen] = useState(false);

  const [varsOpen, setVarsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [sendersOpen, setSendersOpen] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    if (!hasSending || isCreating) return;
    const t = setInterval(fetchAll, 4000);
    return () => clearInterval(t);
  }, [campaigns, fetchAll, isCreating]);

  const sources = Array.from(new Set(leads.map(l => l.sourceAccount).filter(Boolean)));

  const targetLeads = formSource === '__all__'
    ? leads
    : leads.filter(l => l.sourceAccount === formSource);

  const handleSend = async () => {
    if (!formSubject.trim() || !formBody.trim()) return;
    if (targetLeads.length === 0) { setSendError('No hay leads para este filtro.'); return; }
    if (selectedSenders.length === 0) { setSendError('Debés seleccionar al menos una cuenta remitente.'); return; }
    
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
      
      setIsCreating(false);
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
    setSelectedSenders(['1']);
  };

  const insertTextAtCursor = (text: string) => {
    if (!textareaRef.current) {
      setFormBody(prev => prev + text);
      return;
    }
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const before = formBody.substring(0, start);
    const after = formBody.substring(end);
    setFormBody(before + text + after);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + text.length;
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleFormat = (tagStart: string, tagEnd: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const selected = formBody.substring(start, end);
    const before = formBody.substring(0, start);
    const after = formBody.substring(end);
    setFormBody(before + tagStart + selected + tagEnd + after);
  };

  const generateAI = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiOpen(false);
    try {
      const fullPrompt = `Generá un email en HTML con tono ${aiTone}. Usa estas características: ${aiPrompt}. Es MUY IMPORTANTE que incluyas variables como {{first_name}} o {{website}} o {{username}} en el texto para personalización automática.`;
      const res = await fetch(`${API_BASE}/emails/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, styles: [aiTone] }),
      });
      const data = await res.json();
      if (res.ok && data.html) {
        insertTextAtCursor(data.html);
      } else {
        alert('Error al generar email: ' + data.error);
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setAiGenerating(false);
    }
  };

  const totalSent    = campaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
  const totalLeadsDB = leads.length;
  const activeCamps  = campaigns.filter(c => c.status === 'sending' || c.status === 'pending').length;

  // --- RENDERING CREATOR VIEW ---
  if (isCreating) {
    return (
      <div className="w-full max-w-7xl mx-auto p-6 space-y-6 flex flex-col h-full">
        {/* Header Creator */}
        <div className="flex items-center justify-between pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsCreating(false)} className="px-3 py-1.5 bg-black/40 border border-white/10 rounded-lg text-xs font-bold text-[#a4a8c0] hover:text-white transition-colors">
              Volver
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5 text-xs text-[#a4a8c0]">
              <Target size={14} className="text-[#e17bd7]" />
              <span>Proyecto por defecto</span>
              <ChevronDown size={14} />
            </div>
          </div>
          <button onClick={handleSend} disabled={sending} className="btn-one flex items-center gap-2 py-2 px-6 text-[10px] uppercase tracking-widest font-black disabled:opacity-50">
            {sending ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} className="fill-current" />}
            {sending ? 'Iniciando...' : 'Iniciar Campaña'}
          </button>
        </div>

        {sendError && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle size={14} />
            {sendError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start">
          {/* LEFT PANE - EDITOR */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Asunto */}
            <div className="glass-card p-5 rounded-2xl">
              <label className="block text-sm font-extrabold font-exo text-[#fefeff] mb-3">Asunto del correo</label>
              <input 
                value={formSubject} onChange={e => setFormSubject(e.target.value)}
                placeholder="¿Tienes cinco minutos?"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all" 
              />
            </div>

            {/* Cuerpo */}
            <div className="glass-card rounded-2xl flex flex-col min-h-[500px]">
              <div className="p-5 border-b border-white/5 flex items-center justify-between">
                <label className="text-sm font-extrabold font-exo text-[#fefeff]">Cuerpo del correo</label>
                <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-white/10">
                  <button className="px-3 py-1 text-[10px] font-bold rounded-md bg-[#e17bd7]/20 text-[#e17bd7]">HTML</button>
                  <button className="px-3 py-1 text-[10px] font-bold rounded-md text-[#a4a8c0] hover:text-white">Vista previa</button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="px-5 py-3 border-b border-white/5 flex items-center gap-4 flex-wrap relative">
                <div className="flex items-center gap-1">
                  <button onClick={() => handleFormat('<b>','</b>')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><Bold size={14} /></button>
                  <button onClick={() => handleFormat('<i>','</i>')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><Italic size={14} /></button>
                  <button onClick={() => handleFormat('<u>','</u>')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><Underline size={14} /></button>
                  <button onClick={() => handleFormat('<s>','</s>')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><Strikethrough size={14} /></button>
                </div>
                <div className="w-[1px] h-4 bg-white/10" />
                <div className="flex items-center gap-1">
                  <button onClick={() => handleFormat('<ul><li>','</li></ul>')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><List size={14} /></button>
                  <button onClick={() => handleFormat('<a href="">','</a>')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><LinkIcon size={14} /></button>
                  <button onClick={() => handleFormat('<img src="" />','')} className="p-1.5 text-[#a4a8c0] hover:text-white rounded hover:bg-white/5"><ImageIcon size={14} /></button>
                </div>
                
                <div className="w-[1px] h-4 bg-white/10" />

                {/* Variables */}
                <div className="relative">
                  <button onClick={() => { setVarsOpen(!varsOpen); setAiOpen(false); setTemplatesOpen(false); }} className="flex items-center gap-1 text-[11px] font-bold text-[#a4a8c0] hover:text-white transition-colors">
                    <Type size={12} /> Variables <ChevronDown size={12} />
                  </button>
                  {varsOpen && (
                    <div className="absolute top-full left-0 mt-2 w-40 bg-[#1a1520] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10">
                      {['first_name', 'website', 'username', 'email', 'source_account'].map(v => (
                        <button key={v} onClick={() => { insertTextAtCursor(`{{${v}}}`); setVarsOpen(false); }} className="w-full text-left px-4 py-2.5 text-xs text-[#a4a8c0] hover:bg-white/5 hover:text-white transition-colors font-mono">
                          {'{{'}{v}{'}}'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Email AI */}
                <div className="relative">
                  <button onClick={() => { setAiOpen(!aiOpen); setVarsOpen(false); setTemplatesOpen(false); }} className="flex items-center gap-1 text-[11px] font-bold text-[#e17bd7] hover:text-[#e17bd7]/80 transition-colors bg-[#e17bd7]/10 px-2 py-1 rounded-lg border border-[#e17bd7]/20">
                    <Wand2 size={12} /> Email AI <ChevronDown size={12} />
                  </button>
                  {aiOpen && (
                    <div className="absolute top-full left-0 mt-2 w-72 bg-[#1a1520] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-10 p-4 space-y-4">
                      <div className="flex items-center gap-2 text-sm font-extrabold text-[#fefeff]">
                        <Bot size={16} className="text-[#e17bd7]"/> Asistente IA
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#a4a8c0]">Tono del email</label>
                        <select value={aiTone} onChange={e => setAiTone(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white">
                          {AI_TONES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-[#a4a8c0]">Directivas (opcional)</label>
                        <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={3} placeholder="Ej: Mencionar que tenemos descuento..." className="w-full bg-black/40 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white resize-none" />
                      </div>
                      <button onClick={generateAI} disabled={aiGenerating} className="w-full btn-one py-2 text-[10px] uppercase font-black flex justify-center items-center gap-2">
                        {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />} Generar e Insertar
                      </button>
                    </div>
                  )}
                </div>

                {/* Plantillas */}
                <div className="relative">
                  <button onClick={() => { setTemplatesOpen(!templatesOpen); setVarsOpen(false); setAiOpen(false); }} className="flex items-center gap-1 text-[11px] font-bold text-[#a4a8c0] hover:text-white transition-colors">
                    <FileText size={12} /> Plantillas <ChevronDown size={12} />
                  </button>
                  {templatesOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-[#1a1520] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-10">
                      {PRESET_TEMPLATES.map(t => (
                        <button key={t.label} onClick={() => { insertTextAtCursor(t.html); setTemplatesOpen(false); }} className="w-full text-left px-4 py-3 text-xs font-bold text-[#a4a8c0] hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Editor area */}
              <div className="flex-1 p-5 relative">
                {aiGenerating && (
                  <div className="absolute inset-0 bg-black/50 backdrop-blur-sm z-10 flex flex-col items-center justify-center text-[#e17bd7] gap-3 rounded-b-2xl">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-xs font-bold animate-pulse">Generando email inteligente...</span>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={formBody}
                  onChange={e => setFormBody(e.target.value)}
                  className="w-full h-full min-h-[300px] bg-transparent text-sm text-[#fefeff] font-mono leading-relaxed resize-none focus:outline-none"
                  placeholder="Escribe tu mensaje en HTML aquí..."
                />
              </div>
            </div>
          </div>

          {/* RIGHT PANE - CONFIG */}
          <div className="glass-card p-5 rounded-2xl space-y-6">
            <h3 className="text-sm font-extrabold font-exo text-[#fefeff] border-b border-white/5 pb-3">
              Configuración del correo
            </h3>

            {/* Titulo Interno */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-[#a4a8c0]">Título del correo (interno)</label>
              <input 
                value={formName} onChange={e => setFormName(e.target.value)}
                placeholder="Ej: Correo para seguidores de @nike"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all" 
              />
            </div>

            {/* Fuente */}
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold text-[#a4a8c0]">Fuente</label>
              <div className="flex bg-black/40 border border-white/10 rounded-xl p-1 mb-2">
                <button onClick={() => setSourceType('analisis')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sourceType === 'analisis' ? 'bg-white/10 text-white' : 'text-[#a4a8c0] hover:text-white'}`}>Análisis</button>
                <button onClick={() => setSourceType('lista')} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${sourceType === 'lista' ? 'bg-white/10 text-white' : 'text-[#a4a8c0] hover:text-white'}`}>Lista</button>
              </div>
              <div className="relative">
                <select 
                  value={formSource} onChange={e => setFormSource(e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-[#6be1e3]/40 rounded-xl px-3 py-2 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#6be1e3] transition-all pr-8 cursor-pointer"
                >
                  <option value="__all__">Todos los leads ({leads.length})</option>
                  {sources.map(s => (
                    <option key={s} value={s}>Seguidores de @{s} ({leads.filter(l => l.sourceAccount === s).length} Correos)</option>
                  ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6be1e3] pointer-events-none" />
              </div>
            </div>

            {/* Cuentas a usar */}
            <div className="space-y-1.5 relative">
              <label className="text-[11px] font-bold text-[#6be1e3] flex items-center gap-1 cursor-pointer hover:underline">
                Cuentas a usar <LinkIcon size={10} />
              </label>
              
              <div className="bg-black/40 border border-white/10 rounded-xl p-2 min-h-[42px] flex flex-wrap gap-2 items-center cursor-text" onClick={() => setSendersOpen(!sendersOpen)}>
                {selectedSenders.map(sid => {
                  const s = SENDER_ACCOUNTS.find(x => x.id === sid);
                  if (!s) return null;
                  return (
                    <div key={s.id} className="flex items-center gap-1 bg-[#6be1e3]/10 text-[#6be1e3] border border-[#6be1e3]/30 px-2 py-1 rounded-lg text-[10px] font-bold">
                      <Mail size={10} /> {s.name}
                      <button onClick={(e) => { e.stopPropagation(); setSelectedSenders(prev => prev.filter(x => x !== s.id)); }} className="hover:text-white ml-1"><X size={10} /></button>
                    </div>
                  );
                })}
                <div className="flex-1 min-w-[50px] flex justify-end">
                  <ChevronDown size={14} className="text-[#a4a8c0]" />
                </div>
              </div>

              {sendersOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-[#1a1520] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 max-h-60 overflow-y-auto">
                  {SENDER_ACCOUNTS.map(s => {
                    const isSelected = selectedSenders.includes(s.id);
                    return (
                      <button 
                        key={s.id} 
                        onClick={() => setSelectedSenders(prev => isSelected ? prev.filter(x => x !== s.id) : [...prev, s.id])}
                        className="w-full text-left px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? 'bg-[#6be1e3] border-[#6be1e3] text-black' : 'border-[#a4a8c0]/50'}`}>
                            {isSelected && <CheckCircle size={10} />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{s.name}</div>
                            <div className="text-[10px] text-[#a4a8c0]">{s.email}</div>
                          </div>
                        </div>
                        <div className="text-[10px] text-[#a4a8c0]">{s.limit}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="pt-4 border-t border-white/5 bg-[#1a1520] rounded-xl p-4 mt-6">
               <h4 className="text-[11px] font-extrabold text-white mb-2">Primeros pasos</h4>
               <div className="flex items-center gap-2 text-[#a4a8c0] text-[10px] hover:text-white cursor-pointer transition-colors">
                  <Play size={12} /> Video Tutorial: Cómo armar campañas
               </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // --- RENDERING LIST VIEW ---
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
          <button type="button" onClick={() => setIsCreating(true)}
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
          <button type="button" onClick={() => setIsCreating(true)}
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
    </div>
  );
}
