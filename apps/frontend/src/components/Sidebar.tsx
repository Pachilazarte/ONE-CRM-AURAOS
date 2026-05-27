'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3, GitBranch, Users, Mail, CheckSquare,
  Zap, Target, UserCircle2, Shield, LogOut, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MockSession } from '@/lib/types';
import ServerStatusBanner from './ServerStatusBanner';

const CRM_NAV = [
  { href: '/dashboard',  label: 'Dashboard',  icon: BarChart3   },
  { href: '/pipeline',   label: 'Pipeline',   icon: GitBranch   },
  { href: '/contactos',  label: 'Contactos',  icon: Users       },
  { href: '/emails',     label: 'Emails',     icon: Mail        },
  { href: '/tareas',     label: 'Tareas',     icon: CheckSquare },
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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar_collapsed') === 'true';
    }
    return false;
  });

  useEffect(() => {
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

  const toggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('sidebar_collapsed', String(next));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('crm_session');
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) => (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={[
        'flex items-center gap-3 rounded-xl text-sm font-bold transition-all duration-150 relative group',
        collapsed ? 'px-0 py-2.5 justify-center' : 'px-4 py-2.5',
        isActive(href)
          ? 'bg-gradient-to-r from-[#e17bd7] to-[#b673df] text-black shadow-[0_0_16px_rgba(225,123,215,0.2)]'
          : 'text-[#a4a8c0] hover:text-[#fefeff] hover:bg-white/5',
      ].join(' ')}
    >
      <Icon size={16} className={`shrink-0 ${isActive(href) ? 'stroke-[2.5]' : ''}`} />
      {!collapsed && <span className="font-exo">{label}</span>}
      {/* Collapsed tooltip */}
      {collapsed && (
        <span className="absolute left-full ml-3 px-2 py-1 text-[10px] font-bold bg-[#1a1520] border border-white/10 rounded-lg text-[#fefeff] whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
          {label}
        </span>
      )}
    </Link>
  );

  return (
    <aside
      className={`shrink-0 bg-gradient-to-b from-[#120f15] to-[#08070b] border-r border-white/5 flex flex-col justify-between relative z-20 transition-all duration-300 ease-in-out ${
        collapsed ? 'w-[64px]' : 'w-60'
      }`}
    >
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#e17bd7]/20 to-transparent" />

      {/* Collapse toggle button */}
      <button
        onClick={toggleCollapse}
        className="absolute -right-3 top-6 w-6 h-6 bg-[#1a1520] border border-white/10 rounded-full flex items-center justify-center text-[#a4a8c0] hover:text-[#e17bd7] hover:border-[#e17bd7]/40 transition-all z-30 shadow-lg"
        title={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <div className={`pt-6 flex-1 overflow-y-auto overflow-x-hidden ${collapsed ? 'px-2' : 'p-5'}`}>
        {/* Logo */}
        <div className={`flex mb-8 ${collapsed ? 'justify-center' : 'justify-center'}`}>
          <div className="w-10 h-10 relative rounded-xl bg-white/5 border border-white/10 shadow-[0_0_20px_rgba(225,123,215,0.1)] overflow-hidden shrink-0">
            <Image src="/img/one-logocolor.png" alt="ONE" fill className="object-contain p-1" priority />
          </div>
        </div>

        <nav className="space-y-0.5">
          {!collapsed && <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-[#a4a8c0]/40 px-3 mb-2">CRM</p>}
          {collapsed && <div className="h-3" />}
          {CRM_NAV.map(item => {
            if (item.href === '/pipeline' && user?.role === 'admin') return null;
            return <NavLink key={item.href} {...item} />;
          })}
        </nav>

        <nav className="space-y-0.5 mt-5">
          {!collapsed && <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-[#a4a8c0]/40 px-3 mb-2">Captación</p>}
          {collapsed && <div className="border-t border-white/5 my-3" />}
          {DATA_NAV.map(item => <NavLink key={item.href} {...item} />)}
        </nav>

        {user?.role === 'admin' && (
          <nav className="mt-5">
            {!collapsed && <p className="text-[9px] uppercase font-bold tracking-[0.15em] text-[#a4a8c0]/40 px-3 mb-2">Sistema</p>}
            {collapsed && <div className="border-t border-white/5 my-3" />}
            <NavLink href="/admin" label="Administración" icon={Shield} />
          </nav>
        )}
      </div>

      {/* Server Status + User Footer */}
      <div className="pb-1">
        {!collapsed && <ServerStatusBanner />}

        <div className={`border-t border-white/5 ${collapsed ? 'p-2' : 'p-4'}`}>
          {user && (
            <div className={`space-y-2 ${collapsed ? 'items-center flex flex-col' : ''}`}>
              {!collapsed && (
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
              )}
              {collapsed ? (
                <button
                  onClick={handleLogout}
                  title="Cerrar sesión"
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-[#a4a8c0]/60 hover:text-red-400 hover:bg-white/5 transition-all"
                >
                  <LogOut size={14} />
                </button>
              ) : (
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold text-[#a4a8c0]/60 hover:text-[#fefeff] hover:bg-white/5 transition-all">
                  <LogOut size={12} />Cerrar sesión
                </button>
              )}
            </div>
          )}
          {!collapsed && <div className="text-center text-[9px] text-[#a4a8c0]/25 mt-2">ONE CRM © 2026</div>}
        </div>
      </div>
    </aside>
  );
}
