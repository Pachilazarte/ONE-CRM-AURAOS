'use client';

import { useEffect, useState } from 'react';
import { Shield, Plus, UserCheck, UserX, Mail, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import type { TeamUser, UserRole, MockSession } from '@/lib/types';
import { MOCK_TEAM } from '@/lib/mock-data';

export default function AdminPage() {
  const [users, setUsers] = useState<TeamUser[]>(MOCK_TEAM);
  const [session, setSession] = useState<MockSession | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('crm_session');
    const s: MockSession = stored ? JSON.parse(stored) : { id: '1', name: 'Admin Demo', email: 'admin@one.com', role: 'admin' };
    setSession(s);
    if (s.role !== 'admin') setUnauthorized(true);
  }, []);

  const toggleActive = (id: string) =>
    setUsers(prev => prev.map(u => u.id === id ? { ...u, isActive: !u.isActive } : u));

  const activeCount = users.filter(u => u.isActive && u.role === 'vendedor').length;
  const totalLeads  = users.reduce((s, u) => s + (u.leadsAssigned || 0), 0);

  if (unauthorized) {
    return (
      <div className="h-full flex items-center justify-center flex-col gap-4 text-center px-6">
        <Shield size={48} className="text-red-400/50" />
        <h2 className="text-xl font-extrabold font-exo text-red-400">Acceso Denegado</h2>
        <p className="text-sm text-[#a4a8c0]">Solo los administradores pueden acceder a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#e17bd7]/4 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Shield size={22} className="text-[#e17bd7]" />Administración
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">Gestión de usuarios y accesos del sistema.</p>
        </div>
        <button className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black">
          <Plus size={13} />Nuevo Usuario
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Usuarios totales',   value: users.length,   color: '#e17bd7' },
          { label: 'Vendedores activos', value: activeCount,    color: '#34d399' },
          { label: 'Leads asignados',    value: totalLeads,     color: '#6be1e3' },
          { label: 'Inactivos',          value: users.filter(u=>!u.isActive).length, color: '#ef4444' },
        ].map(s => (
          <div key={s.label} className="glass-card p-4 rounded-2xl flex items-center justify-between">
            <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">{s.label}</span>
            <span className="text-2xl font-black font-exo" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="glass-card overflow-hidden rounded-2xl border-white/5">
        <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-extrabold font-exo text-[#fefeff]">Equipo</h2>
          <span className="text-[10px] text-[#a4a8c0]/50">{users.length} usuarios registrados</span>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]/50">
              <th className="px-5 py-3.5">Usuario</th>
              <th className="px-5 py-3.5">Rol</th>
              <th className="px-5 py-3.5">Leads Asignados</th>
              <th className="px-5 py-3.5">Última actividad</th>
              <th className="px-5 py-3.5">Estado</th>
              <th className="px-5 py-3.5 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {users.map(u => (
              <tr key={u.id} className={`text-xs transition-all ${!u.isActive ? 'opacity-50' : 'hover:bg-white/[0.01]'} group`}>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${u.role === 'admin' ? 'bg-[#e17bd7]/20 text-[#e17bd7] border border-[#e17bd7]/20' : 'bg-[#6be1e3]/10 text-[#6be1e3] border border-[#6be1e3]/20'}`}>
                      {u.name.substring(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-extrabold text-[#fefeff]">{u.name}</div>
                      <div className="flex items-center gap-1 text-[9px] text-[#a4a8c0]/50 mt-0.5">
                        <Mail size={8} />{u.email}
                      </div>
                    </div>
                  </div>
                </td>

                <td className="px-5 py-4">
                  <span className={`inline-flex items-center text-[8px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg border ${u.role === 'admin' ? 'bg-[#e17bd7]/10 text-[#e17bd7] border-[#e17bd7]/20' : 'bg-[#6be1e3]/10 text-[#6be1e3] border-[#6be1e3]/20'}`}>
                    {u.role}
                  </span>
                </td>

                <td className="px-5 py-4">
                  <span className="font-black text-[#fefeff]">{u.leadsAssigned ?? 0}</span>
                </td>

                <td className="px-5 py-4 text-[10px] text-[#a4a8c0]/60">{u.lastActivity}</td>

                <td className="px-5 py-4">
                  <div className="flex items-center gap-2">
                    {u.isActive
                      ? <><span className="w-1.5 h-1.5 bg-[#34d399] rounded-full shadow-[0_0_6px_#34d399]" /><span className="text-[10px] font-bold text-[#34d399]">Activo</span></>
                      : <><span className="w-1.5 h-1.5 bg-red-400 rounded-full" /><span className="text-[10px] font-bold text-red-400">Inactivo</span></>
                    }
                  </div>
                </td>

                <td className="px-5 py-4">
                  <div className="flex items-center justify-center gap-2">
                    <button className="p-1.5 rounded-lg text-[#a4a8c0]/50 hover:text-[#fefeff] hover:bg-white/5 transition-all" title="Editar">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => toggleActive(u.id)}
                      className={`p-1.5 rounded-lg transition-all ${u.isActive ? 'text-[#34d399] hover:text-red-400 hover:bg-red-400/10' : 'text-red-400 hover:text-[#34d399] hover:bg-[#34d399]/10'}`}
                      title={u.isActive ? 'Desactivar acceso' : 'Activar acceso'}>
                      {u.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security note */}
      <div className="glass-card p-4 rounded-xl flex items-start gap-3 border-[#e4c76a]/10">
        <Shield size={15} className="text-[#e4c76a] shrink-0 mt-0.5" />
        <div className="text-[11px] text-[#a4a8c0]">
          <span className="text-[#e4c76a] font-bold">Seguridad: </span>
          Las contraseñas se almacenan hasheadas con Argon2id (factor de costo ≥12). Desactivar un usuario revoca inmediatamente todos sus tokens activos. JWT con expiración de 15 min + Refresh Token rotativo en cookie HttpOnly.
        </div>
      </div>
    </div>
  );
}
