'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const DEMO = [
  { label: 'Admin',    email: 'admin@one.com',   password: 'admin123',    role: 'admin'    },
  { label: 'Vendedor', email: 'carlos@one.com',  password: 'vendedor123', role: 'vendedor' },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError || !authData.user) {
      setError('Credenciales incorrectas.');
      setLoading(false);
      return;
    }

    // Fetch CRM profile (name + role)
    const { data: profile } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('auth_id', authData.user.id)
      .single();

    if (profile) {
      localStorage.setItem('crm_session', JSON.stringify({
        id:    profile.id,
        name:  profile.name,
        email: profile.email,
        role:  profile.role,
      }));
    }

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen w-full bg-[#0d0b0f] flex items-center justify-center relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-[#e17bd7]/8 blur-[200px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#6be1e3]/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md px-6 relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 relative rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_30px_rgba(225,123,215,0.2)] overflow-hidden mb-5">
            <Image src="/img/one-logocolor.png" alt="ONE" fill className="object-contain p-2" priority />
          </div>
          <h1 className="text-2xl font-black font-exo text-[#fefeff]">ONE CRM</h1>
          <p className="text-xs text-[#a4a8c0] mt-1">Iniciá sesión para acceder a tu plataforma</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-3xl border-white/10 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#e17bd7]/30 to-transparent" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a4a8c0]/50" size={15} />
                <input
                  type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-11 pr-4 text-sm text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all placeholder:text-[#a4a8c0]/30"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a4a8c0]/50" size={15} />
                <input
                  type={showPass ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-black/50 border border-white/10 rounded-2xl py-3.5 pl-11 pr-12 text-sm text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a4a8c0]/50 hover:text-[#a4a8c0] transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-xs text-red-400">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="btn-one w-full flex items-center justify-center gap-2 py-4 text-sm font-black uppercase tracking-widest disabled:opacity-50 mt-2">
              {loading ? <Loader2 className="animate-spin" size={16} /> : 'Iniciar Sesión'}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="border-t border-white/5 pt-5 space-y-2">
            <p className="text-[9px] uppercase font-bold tracking-widest text-[#a4a8c0]/50 text-center">Acceso demo</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map(u => (
                <button key={u.email} onClick={() => { setEmail(u.email); setPassword(u.password); setError(''); }}
                  className="flex flex-col items-start p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-[#e17bd7]/30 hover:bg-white/5 transition-all text-left">
                  <span className={`text-[8px] font-black uppercase tracking-wider mb-1 ${u.role === 'admin' ? 'text-[#e17bd7]' : 'text-[#6be1e3]'}`}>
                    {u.role}
                  </span>
                  <span className="text-[10px] font-bold text-[#fefeff]">{u.email}</span>
                  <span className="text-[9px] text-[#a4a8c0]/50">{u.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
