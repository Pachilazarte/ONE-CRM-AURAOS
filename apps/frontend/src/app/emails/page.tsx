'use client';

import { useState, useRef } from 'react';
import {
  Mail, Send, Plus, ArrowLeft, Wand2, Code2, Eye,
  Loader2, Sparkles, ChevronRight, X, CheckCircle, AlertCircle,
} from 'lucide-react';
import type { EmailThread } from '@/lib/types';
import { API_BASE } from '@/lib/types';
import { MOCK_EMAILS } from '@/lib/mock-data';

const EMAIL_STYLES = [
  { key: 'formal', label: 'Formal', emoji: '👔' },
  { key: 'casual', label: 'Casual', emoji: '😊' },
  { key: 'persuasivo', label: 'Persuasivo', emoji: '🎯' },
  { key: 'breve', label: 'Breve', emoji: '⚡' },
  { key: 'detallado', label: 'Detallado', emoji: '📋' },
  { key: 'con CTA', label: 'Con CTA', emoji: '🚀' },
];

type MainView = 'inbox' | 'compose' | 'ai_generator';

export default function EmailsPage() {
  const [threads, setThreads] = useState<EmailThread[]>(MOCK_EMAILS);
  const [selected, setSelected] = useState<EmailThread | null>(null);
  const [replyText, setReplyText] = useState('');
  const [mainView, setMainView] = useState<MainView>('inbox');

  // HTML composer
  const [composeTab, setComposeTab] = useState<'text' | 'html'>('text');
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeHtml, setComposeHtml] = useState('');
  const [htmlPreviewMode, setHtmlPreviewMode] = useState(false);
  const [sendingCompose, setSendingCompose] = useState(false);
  const [composeResult, setComposeResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // AI generator
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiStyles, setAiStyles] = useState<string[]>([]);
  const [aiContext, setAiContext] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiHtml, setAiHtml] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiPreview, setAiPreview] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const unreadCount = threads.filter(t => t.unread).length;

  const handleSelect = (thread: EmailThread) => {
    setSelected(thread);
    setMainView('inbox');
    setThreads(prev => prev.map(t => t.id === thread.id ? { ...t, unread: false } : t));
    setReplyText('');
  };

  const handleSendReply = () => {
    if (!replyText.trim() || !selected) return;
    const newMsg = {
      id: `m${Date.now()}`,
      from: 'yo@one.com',
      to: selected.contactEmail,
      body: replyText,
      date: 'Ahora',
    };
    const updated = { ...selected, messages: [...selected.messages, newMsg] };
    setSelected(updated);
    setThreads(prev => prev.map(t => t.id === selected.id ? updated : t));
    setReplyText('');
  };

  const handleComposeSend = async () => {
    if (!composeTo || !composeSubject) return;
    setSendingCompose(true);
    setComposeResult(null);
    try {
      const body = composeTab === 'html' ? composeHtml : `<p>${composeText}</p>`;
      const res = await fetch(`${API_BASE}/emails/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: composeTo, subject: composeSubject, html: body }),
      });
      const data = await res.json();
      if (res.ok) {
        setComposeResult({ ok: true, msg: `Email enviado correctamente (ID: ${data.id})` });
        setTimeout(() => { setMainView('inbox'); setComposeResult(null); }, 2500);
      } else {
        setComposeResult({ ok: false, msg: data.error || 'Error al enviar' });
      }
    } catch (e) {
      setComposeResult({ ok: false, msg: String(e) });
    } finally {
      setSendingCompose(false);
    }
  };

  const toggleAiStyle = (key: string) => {
    setAiStyles(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError('');
    setAiHtml('');
    setAiPreview(false);
    try {
      const res = await fetch(`${API_BASE}/emails/generate-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, styles: aiStyles, context: aiContext }),
      });
      const data = await res.json();
      if (res.ok && data.html) {
        setAiHtml(data.html);
      } else {
        setAiError(data.error || 'Error al generar');
      }
    } catch (e) {
      setAiError(String(e));
    } finally {
      setAiGenerating(false);
    }
  };

  const useAiHtml = () => {
    setComposeHtml(aiHtml);
    setComposeTab('html');
    setMainView('compose');
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Mail size={22} className="text-[#e17bd7]" />Emails
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">{unreadCount} sin leer · {threads.length} conversaciones</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMainView('ai_generator')}
            className={`flex items-center gap-2 py-2.5 px-4 text-[10px] uppercase tracking-widest font-black rounded-xl border transition-all ${
              mainView === 'ai_generator'
                ? 'bg-[#e17bd7]/20 border-[#e17bd7]/40 text-[#e17bd7]'
                : 'border-white/10 text-[#a4a8c0] hover:border-[#e17bd7]/30 hover:text-[#e17bd7]'
            }`}
          >
            <Wand2 size={13} />Generar con IA
          </button>
          <button
            onClick={() => setMainView('compose')}
            className="btn-one flex items-center gap-2 py-2.5 px-4 text-[10px] uppercase tracking-widest font-black"
          >
            <Plus size={13} />Nuevo Email
          </button>
        </div>
      </div>

      {/* === AI Generator View === */}
      {mainView === 'ai_generator' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setMainView('inbox')} className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div>
                <h2 className="text-lg font-extrabold font-exo flex items-center gap-2">
                  <Wand2 size={18} className="text-[#e17bd7]" />
                  Generador de Emails con IA
                </h2>
                <p className="text-xs text-[#a4a8c0]">El HTML del email se genera automáticamente para envío directo.</p>
              </div>
            </div>

            <div className="glass-card p-6 rounded-2xl space-y-5">
              {/* Prompt */}
              <div className="space-y-2">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                  Objetivo del email <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder="Ej: Presentar nuestra plataforma ONE CRM a consultoras de RRHH que buscan organizar su pipeline..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all resize-none"
                />
              </div>

              {/* Style tags */}
              <div className="space-y-2">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                  Estilo del email
                </label>
                <div className="flex flex-wrap gap-2">
                  {EMAIL_STYLES.map(s => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => toggleAiStyle(s.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                        aiStyles.includes(s.key)
                          ? 'bg-[#e17bd7]/20 border-[#e17bd7]/50 text-[#e17bd7]'
                          : 'bg-black/30 border-white/10 text-[#a4a8c0] hover:border-white/20'
                      }`}
                    >
                      <span>{s.emoji}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context */}
              <div className="space-y-2">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                  Contexto adicional (opcional)
                </label>
                <input
                  type="text"
                  value={aiContext}
                  onChange={e => setAiContext(e.target.value)}
                  placeholder="Ej: Empresa: ONE CRM · Producto: AuraOS · Precio desde $299/mes"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                />
              </div>

              <button
                onClick={handleGenerateAi}
                disabled={!aiPrompt.trim() || aiGenerating}
                className="btn-one w-full flex items-center justify-center gap-2 py-3.5 text-xs uppercase tracking-widest font-black disabled:opacity-40"
              >
                {aiGenerating
                  ? <><Loader2 size={14} className="animate-spin" />Generando...</>
                  : <><Sparkles size={14} />Generar Email</>}
              </button>

              {aiError && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-red-300">{aiError}</p>
                </div>
              )}
            </div>

            {/* Result */}
            {aiHtml && (
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#6be1e3] flex items-center gap-1.5">
                    <CheckCircle size={13} />Email generado
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAiPreview(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                        aiPreview ? 'bg-[#6be1e3]/20 border-[#6be1e3]/40 text-[#6be1e3]' : 'border-white/10 text-[#a4a8c0]'
                      }`}
                    >
                      <Eye size={11} />Preview
                    </button>
                    <button
                      onClick={useAiHtml}
                      className="btn-one flex items-center gap-1.5 px-3 py-1.5 text-[10px] uppercase font-black"
                    >
                      <ChevronRight size={11} />Usar este HTML
                    </button>
                  </div>
                </div>
                {aiPreview ? (
                  <div className="bg-white rounded-b-2xl" style={{ height: '400px' }}>
                    <iframe
                      ref={iframeRef}
                      srcDoc={aiHtml}
                      sandbox="allow-same-origin"
                      className="w-full h-full border-0 rounded-b-2xl"
                      title="Preview del email generado"
                    />
                  </div>
                ) : (
                  <pre className="p-5 text-[10px] text-[#a4a8c0] font-mono overflow-x-auto max-h-64 leading-relaxed whitespace-pre-wrap">
                    {aiHtml}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Compose View === */}
      {mainView === 'compose' && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setMainView('inbox')} className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors">
                <ArrowLeft size={18} />
              </button>
              <h2 className="text-lg font-extrabold font-exo flex items-center gap-2">
                <Send size={18} className="text-[#e17bd7]" />Nuevo Email
              </h2>
            </div>

            <div className="glass-card p-6 rounded-2xl space-y-4">
              <div className="space-y-2">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Para</label>
                <input
                  type="email" value={composeTo} onChange={e => setComposeTo(e.target.value)}
                  placeholder="destinatario@empresa.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Asunto</label>
                <input
                  type="text" value={composeSubject} onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Asunto del email"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                />
              </div>

              {/* Text / HTML tabs */}
              <div>
                <div className="flex border-b border-white/5 mb-4">
                  <button
                    type="button"
                    onClick={() => setComposeTab('text')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest transition-all ${composeTab === 'text' ? 'text-[#e17bd7] border-b-2 border-[#e17bd7]' : 'text-[#a4a8c0]/60'}`}
                  >
                    <Mail size={11} />Texto
                  </button>
                  <button
                    type="button"
                    onClick={() => { setComposeTab('html'); setHtmlPreviewMode(false); }}
                    className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest transition-all ${composeTab === 'html' ? 'text-[#e17bd7] border-b-2 border-[#e17bd7]' : 'text-[#a4a8c0]/60'}`}
                  >
                    <Code2 size={11} />HTML
                  </button>
                </div>

                {composeTab === 'text' ? (
                  <textarea
                    rows={8} value={composeText} onChange={e => setComposeText(e.target.value)}
                    placeholder="Escribí tu mensaje..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all resize-none"
                  />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-[#a4a8c0]/60">Pegá tu código HTML o usá el generador IA</span>
                      <button
                        type="button"
                        onClick={() => setHtmlPreviewMode(v => !v)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${htmlPreviewMode ? 'bg-[#6be1e3]/20 border-[#6be1e3]/40 text-[#6be1e3]' : 'border-white/10 text-[#a4a8c0]'}`}
                      >
                        <Eye size={11} />{htmlPreviewMode ? 'Ver código' : 'Preview HTML'}
                      </button>
                    </div>
                    {htmlPreviewMode ? (
                      <div className="bg-white rounded-xl overflow-hidden" style={{ height: '300px' }}>
                        <iframe
                          srcDoc={composeHtml || '<p style="color:#999;font-family:sans-serif;padding:20px">Vista previa del HTML aquí...</p>'}
                          sandbox="allow-same-origin"
                          className="w-full h-full border-0"
                          title="Preview HTML"
                        />
                      </div>
                    ) : (
                      <textarea
                        rows={8} value={composeHtml} onChange={e => setComposeHtml(e.target.value)}
                        placeholder="<html><body>...</body></html>"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#6be1e3] font-mono focus:outline-none focus:border-[#e17bd7] transition-all resize-none"
                        spellCheck={false}
                      />
                    )}
                    {!composeHtml && (
                      <button
                        type="button"
                        onClick={() => setMainView('ai_generator')}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-[#e17bd7] hover:text-[#e17bd7]/80 transition-colors"
                      >
                        <Wand2 size={11} />Generar HTML con IA
                      </button>
                    )}
                  </div>
                )}
              </div>

              {composeResult && (
                <div className={`flex items-center gap-2 p-3 rounded-xl border ${composeResult.ok ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                  {composeResult.ok ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                  <span className="text-[11px] font-semibold">{composeResult.msg}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-white/5">
                <button type="button" onClick={() => setMainView('inbox')} className="text-[#a4a8c0]/50 hover:text-[#a4a8c0] transition-colors">
                  <X size={16} />
                </button>
                <button
                  onClick={handleComposeSend}
                  disabled={!composeTo || !composeSubject || sendingCompose}
                  className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black disabled:opacity-30"
                >
                  {sendingCompose ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  {sendingCompose ? 'Enviando...' : 'Enviar Email'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === Inbox View === */}
      {mainView === 'inbox' && (
        <div className="flex flex-1 overflow-hidden">
          {/* Thread list */}
          <div className="w-80 shrink-0 border-r border-white/5 overflow-y-auto">
            {threads.map(thread => (
              <button key={thread.id} onClick={() => handleSelect(thread)}
                className={`w-full text-left p-4 border-b border-white/5 transition-all hover:bg-white/[0.02] ${selected?.id === thread.id ? 'bg-white/[0.03] border-l-2 border-l-[#e17bd7]' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {thread.unread && <span className="w-2 h-2 bg-[#e17bd7] rounded-full shrink-0 shadow-[0_0_6px_#e17bd7]" />}
                    <span className={`text-xs font-${thread.unread ? 'extrabold' : 'semibold'} text-[#fefeff] truncate`}>
                      {thread.contactName}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${thread.direction === 'in' ? 'bg-[#6be1e3]/10 text-[#6be1e3]' : 'bg-[#e17bd7]/10 text-[#e17bd7]'}`}>
                      {thread.direction === 'in' ? 'Recibido' : 'Enviado'}
                    </span>
                    <span className="text-[9px] text-[#a4a8c0]/50">{thread.date}</span>
                  </div>
                </div>
                <div className={`text-xs ${thread.unread ? 'font-bold text-[#fefeff]' : 'text-[#a4a8c0]'} truncate mb-0.5`}>
                  {thread.subject}
                </div>
                <div className="text-[10px] text-[#a4a8c0]/50 truncate">{thread.preview}</div>
              </button>
            ))}
          </div>

          {/* Thread view */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selected ? (
              <>
                <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3 shrink-0">
                  <button onClick={() => setSelected(null)} className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors md:hidden">
                    <ArrowLeft size={18} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-extrabold text-[#fefeff]">{selected.subject}</div>
                    <div className="text-xs text-[#a4a8c0] mt-0.5">
                      Conversación con <span className="text-[#6be1e3] font-bold">{selected.contactName}</span>
                      {' · '}{selected.messages.length} mensaje{selected.messages.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {selected.messages.map(msg => {
                    const isMe = msg.from.endsWith('@one.com') || msg.from === 'yo@one.com';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl p-4 space-y-2 ${isMe ? 'bg-[#e17bd7]/10 border border-[#e17bd7]/20' : 'glass-card border-white/5'}`}>
                          <div className="flex items-center justify-between gap-4">
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${isMe ? 'text-[#e17bd7]' : 'text-[#6be1e3]'}`}>
                              {isMe ? 'Yo' : selected.contactName}
                            </span>
                            <span className="text-[9px] text-[#a4a8c0]/50">{msg.date}</span>
                          </div>
                          <p className="text-xs text-[#fefeff]/90 leading-relaxed">{msg.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 border-t border-white/5 space-y-3 shrink-0">
                  <textarea
                    value={replyText} onChange={e => setReplyText(e.target.value)}
                    placeholder={`Responder a ${selected.contactName}...`} rows={3}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-[#fefeff] font-semibold resize-none focus:outline-none focus:border-[#e17bd7] transition-all"
                  />
                  <div className="flex justify-end">
                    <button onClick={handleSendReply} disabled={!replyText.trim()}
                      className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black disabled:opacity-30">
                      <Send size={12} />Enviar Respuesta
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center flex-col gap-3 text-[#a4a8c0]/30">
                <Mail size={40} />
                <p className="text-sm">Seleccioná una conversación</p>
                <p className="text-[11px]">o usá el generador IA para crear un email nuevo</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
