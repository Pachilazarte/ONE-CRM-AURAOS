'use client';

import { useState } from 'react';
import { Mail, Send, Plus, ChevronRight, ArrowLeft, Reply } from 'lucide-react';
import type { EmailThread } from '@/lib/types';
import { MOCK_EMAILS } from '@/lib/mock-data';

export default function EmailsPage() {
  const [threads, setThreads]     = useState<EmailThread[]>(MOCK_EMAILS);
  const [selected, setSelected]   = useState<EmailThread | null>(null);
  const [replyText, setReplyText] = useState('');

  const unreadCount = threads.filter(t => t.unread).length;

  const handleSelect = (thread: EmailThread) => {
    setSelected(thread);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Mail size={22} className="text-[#e17bd7]" />Bandeja de Emails
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">{unreadCount} sin leer · {threads.length} conversaciones</p>
        </div>
        <button className="btn-one flex items-center gap-2 py-2.5 px-4 text-[10px] uppercase tracking-widest font-black">
          <Plus size={13} />Nuevo Email
        </button>
      </div>

      {/* Split view */}
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
              {/* Thread header */}
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

              {/* Messages */}
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

              {/* Reply box */}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
