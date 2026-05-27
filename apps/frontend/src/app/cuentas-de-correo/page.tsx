'use client';

import React, { useState, useEffect } from 'react';
import { Mail, ShieldCheck, Zap, Plus, RefreshCw, Server, AlertCircle } from 'lucide-react';
import { API_BASE } from '@/lib/types';

interface EmailAccount {
  id: string;
  name: string;
  email: string;
  limit: string;
}

export default function CuentasDeCorreoPage() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/email-accounts`);
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8 flex flex-col h-full relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#6be1e3]/5 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Mail size={22} className="text-[#6be1e3]" />
            Cuentas de Correo
          </h1>
          <p className="text-sm text-[#a4a8c0] mt-1">Administrá las cuentas conectadas a tu sistema de envío (Resend).</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={fetchAccounts} className="p-2 rounded-xl border border-white/10 text-[#a4a8c0] hover:text-[#fefeff] hover:border-white/20 transition-all">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black opacity-50 cursor-not-allowed" title="Próximamente">
            <Plus size={12} /> Añadir Cuenta
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
        {/* Left Column: Cuentas List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-sm font-extrabold text-white mb-4 uppercase tracking-wider">Cuentas Conectadas</h2>
          
          {loading ? (
            <div className="glass-card p-10 flex justify-center items-center rounded-2xl">
              <RefreshCw size={24} className="text-[#6be1e3] animate-spin" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="glass-card p-8 rounded-2xl text-center space-y-3">
              <AlertCircle size={32} className="mx-auto text-red-400" />
              <p className="text-sm text-[#a4a8c0]">No se encontró ninguna cuenta configurada en el servidor.</p>
            </div>
          ) : (
            accounts.map(acc => (
              <div key={acc.id} className="glass-card p-6 rounded-2xl flex flex-col md:flex-row gap-6 justify-between items-start md:items-center group hover:border-[#6be1e3]/30 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[#6be1e3]/10 border border-[#6be1e3]/30 flex items-center justify-center shrink-0">
                    <Server size={20} className="text-[#6be1e3]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      {acc.name} 
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest font-black flex items-center gap-1">
                        <ShieldCheck size={10} /> Activa
                      </span>
                    </h3>
                    <p className="text-sm text-[#a4a8c0] font-mono mt-1">{acc.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-8 md:gap-4 bg-black/20 rounded-xl px-5 py-3 border border-white/5 w-full md:w-auto justify-between">
                  <div>
                    <p className="text-[10px] text-[#a4a8c0] uppercase tracking-wider font-bold mb-0.5">Límite</p>
                    <p className="text-sm font-bold text-white">{acc.limit}</p>
                  </div>
                  <div className="h-8 w-[1px] bg-white/10" />
                  <div>
                    <p className="text-[10px] text-[#a4a8c0] uppercase tracking-wider font-bold mb-0.5">Estado</p>
                    <p className="text-sm font-bold text-[#6be1e3]">Conectado</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Info / Upgrade */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl border-t border-[#e17bd7]/30 bg-gradient-to-b from-[#e17bd7]/5 to-transparent relative overflow-hidden">
            <Zap size={100} className="absolute -right-6 -bottom-6 text-[#e17bd7]/10" />
            <h3 className="text-sm font-extrabold text-white mb-2 relative z-10">Múltiples Cuentas (Próximamente)</h3>
            <p className="text-xs text-[#a4a8c0] leading-relaxed relative z-10 mb-4">
              La conexión de múltiples cuentas de correo a través de Resend o SMTP personalizado estará disponible en la próxima actualización. Por ahora, todas las campañas utilizarán tu <strong>Cuenta Principal</strong> configurada en el entorno seguro.
            </p>
            <div className="flex -space-x-2 relative z-10">
              <div className="w-8 h-8 rounded-full border-2 border-[#1a1520] bg-[#6be1e3]/20 flex items-center justify-center"><Mail size={12} className="text-[#6be1e3]" /></div>
              <div className="w-8 h-8 rounded-full border-2 border-[#1a1520] bg-[#e4c76a]/20 flex items-center justify-center"><Mail size={12} className="text-[#e4c76a]" /></div>
              <div className="w-8 h-8 rounded-full border-2 border-[#1a1520] bg-[#e17bd7]/20 flex items-center justify-center"><Mail size={12} className="text-[#e17bd7]" /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
