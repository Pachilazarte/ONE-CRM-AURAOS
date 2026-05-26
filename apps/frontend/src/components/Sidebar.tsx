'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, GitBranch, Users, Mail, CheckSquare,
  Zap, Target, UserCircle2, Shield, LogOut,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MockSession } from '@/lib/types';

const CRM_NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: BarChart3     },
  { href: '/pipeline',   label: 'Pipeline',   icon: GitBranch     },
  { href: '/contactos',  label: 'Contactos',  icon: Users         },
  { href: '/emails',     label: 'Emails',     icon: Mail          },
  { href: '/tareas',     label: 'Tareas',     icon: CheckSquare   },
];

const DATA_NAV = [
  { href: '/extraccion', label: 'Extracción', icon: Zap         },
  { href: '/campanas',   label: 'Campañas',   icon: Target      },
  { href: '/prospectos', label: 'Prospectos', icon: UserCircle2 },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<MockSession | null>(null);

  useEffect(() => {
    // Try localStorage first (fast), then validate with Supabase
    const cached = localStorage.getItem('crm_session');
    if (cached) setUser(JSON.parse(cached));

    supabase.auth.getUser().then(async ({ data: { user: authUser } }) => {
      if (!authUser) return;
      const { data: profile } = await supabase
        .from('users')
        .select('id, name, email, role')
        .eq('auth_id', authUser.id)
        .single();
      if (profile) {
        const session: MockSession = { id: profile.id, name: profile.name, email: profile.email, role: profile.role };
        setUser(session);
        localStorage.setItem('crm_session', JSON.stringify(session));
      }
    });
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('crm_session');
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => (
    <Link href={href} className={[
      'flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-150',
      isActive(href)
        ? 'bg-gradient-to-r from-[#e17bd7] to-[#b673df] text-black shadow-[0_0_16px_rgba(225,123,215,0.2)]'
        : 'text-[#a4a8c0] hover:text-[#fefeff] hover:bg-white/5',
    ].join(' ')}>
      <Icon size={16} className={isActive(href) ? 'stroke-[2.5]' : ''} />
      <span className="font-exo">{label}</span>
    </Link>
  );

  return (
    <aside className="w-60 shrink-0 bg-gradient-to-b from-[#120f15] to-[#08070b] border-r border-white/5 flex flex-col justify-between relative z-20">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#e17bd7]/20 to-transparent" />

      <div className="p-5 pt-6 flex-1 overflow-y-auto">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-16 h-16 relative rounded-2xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(225,123,215,0.1)] overflow-hidden">
            <Image src="/img/one-logocolor.png" alt="ONE" fill className="object-contain p-1.5" priority />
          </div>
        </div>

        <nav className="space-y-0.5">
          <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-[#a4a8c0]/40 px-3 mb-2">CRM</p>
          {CRM_NAV.map(item => <NavLink key={item.href} {...item} />)}
        </nav>

        <nav className="space-y-0.5 mt-5">
          <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-[#a4a8c0]/40 px-3 mb-2">Captación</p>
          {DATA_NAV.map(item => <NavLink key={item.href} {...item} />)}
        </nav>

        {user?.role === 'admin' && (
          <nav className="mt-5">
            <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-[#a4a8c0]/40 px-3 mb-2">Sistema</p>
            <NavLink href="/admin" label="Administración" icon={Shield} />
          </nav>
        )}
      </div>

      {/* User Footer */}
      <div className="p-4 border-t border-white/5">
        {user && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#e17bd7] to-[#b673df] flex items-center justify-center text-[10px] font-black text-black shrink-0">
                {user.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#fefeff] truncate">{user.name}</div>
                <div className={`text-[9px] font-bold uppercase tracking-wider ${user.role === 'admin' ? 'text-[#e17bd7]' : 'text-[#6be1e3]'}`}>
                  {user.role}
                </div>
              </div>
            </div>
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold text-[#a4a8c0]/60 hover:text-[#fefeff] hover:bg-white/5 transition-all">
              <LogOut size={12} />Cerrar sesión
            </button>
          </div>
        )}
        <div className="text-center text-[9px] text-[#a4a8c0]/25 mt-2">ONE CRM © 2026</div>
      </div>
    </aside>
  );
}
