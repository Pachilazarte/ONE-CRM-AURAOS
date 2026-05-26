'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import { supabase } from '@/lib/supabase';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const hideSidebar = pathname === '/login';

  useEffect(() => {
    if (hideSidebar) return;

    // Check session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login');
    });

    // React to sign-out from any tab
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/login');
    });

    return () => subscription.unsubscribe();
  }, [hideSidebar, router]);

  return (
    <>
      {!hideSidebar && <Sidebar />}
      <main className={`${hideSidebar ? 'w-full' : 'flex-1'} min-w-0 overflow-y-auto overflow-x-hidden bg-[#0d0b0f] relative`}>
        {children}
      </main>
    </>
  );
}
