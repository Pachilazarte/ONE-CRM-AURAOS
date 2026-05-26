'use client';

import { useState } from 'react';
import { CheckSquare, Plus, AlertCircle, Calendar, User, Check } from 'lucide-react';
import type { Task, TaskPriority } from '@/lib/types';
import { MOCK_TASKS } from '@/lib/mock-data';

const TODAY      = '2026-05-18';
const TOMORROW   = '2026-05-19';

const PRIORITY_INFO: Record<TaskPriority, { color: string; label: string }> = {
  high:   { color: '#e17bd7', label: 'Alta'  },
  medium: { color: '#e4c76a', label: 'Media' },
  low:    { color: '#a4a8c0', label: 'Baja'  },
};

function TaskRow({ task, onToggle }: { task: Task; onToggle: (id: string) => void }) {
  const pInfo = PRIORITY_INFO[task.priority];
  return (
    <div className={`flex items-start gap-4 p-4 rounded-xl border transition-all group ${task.completed ? 'border-white/5 opacity-50' : 'glass-card border-white/5 hover:border-white/15'}`}>
      <button onClick={() => onToggle(task.id)}
        className={`mt-0.5 w-5 h-5 rounded-md border-2 shrink-0 flex items-center justify-center transition-all ${task.completed ? 'bg-[#34d399] border-[#34d399]' : 'border-white/20 hover:border-[#e17bd7]'}`}>
        {task.completed && <Check size={11} className="text-black font-black" strokeWidth={3} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className={`text-sm font-bold ${task.completed ? 'line-through text-[#a4a8c0]/50' : 'text-[#fefeff] group-hover:text-[#e17bd7] transition-colors'}`}>
          {task.title}
        </div>
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {task.contactName && (
            <span className="flex items-center gap-1 text-[9px] font-bold text-[#6be1e3]">
              <User size={9} />{task.contactName.split(' ')[0]}
            </span>
          )}
          <span className="flex items-center gap-1 text-[9px] font-bold text-[#a4a8c0]/60">
            <User size={9} />{task.assignedTo.split(' ')[0]}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded border`}
          style={{ color: pInfo.color, borderColor: pInfo.color + '30', backgroundColor: pInfo.color + '11' }}>
          {pInfo.label}
        </span>
        <span className="text-[9px] font-bold text-[#a4a8c0]/60 flex items-center gap-1">
          <Calendar size={9} />{task.dueDate.substring(5).replace('-','/')}
        </span>
      </div>
    </div>
  );
}

export default function TareasPage() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [assigneeFilter, setAssignee] = useState('');

  const toggle = (id: string) =>
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

  const visible = tasks.filter(t => {
    if (filter === 'pending' && t.completed) return false;
    if (filter === 'done'    && !t.completed) return false;
    if (assigneeFilter && !t.assignedTo.toLowerCase().includes(assigneeFilter.toLowerCase())) return false;
    return true;
  });

  const grouped = {
    today:    visible.filter(t => t.dueDate === TODAY    && !t.completed),
    tomorrow: visible.filter(t => t.dueDate === TOMORROW && !t.completed),
    later:    visible.filter(t => t.dueDate >  TOMORROW  && !t.completed),
    done:     visible.filter(t => t.completed),
  };

  const pendingCount = tasks.filter(t => !t.completed).length;
  const overdueCount = tasks.filter(t => !t.completed && t.dueDate < TODAY).length;

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#e4c76a]/4 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <CheckSquare size={22} className="text-[#e17bd7]" />Tareas
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">{pendingCount} pendientes
            {overdueCount > 0 && <span className="text-red-400"> · {overdueCount} vencidas</span>}
          </p>
        </div>
        <button className="btn-one flex items-center gap-2 py-2.5 px-4 text-[10px] uppercase tracking-widest font-black">
          <Plus size={13} />Nueva Tarea
        </button>
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-3 flex-wrap">
        {(['all','pending','done'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all ${
              filter === f ? 'bg-[#e17bd7] text-black shadow-[0_0_15px_rgba(225,123,215,0.2)]' : 'bg-white/5 text-[#a4a8c0] hover:text-[#fefeff]'
            }`}>
            {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Completadas'}
          </button>
        ))}
        <div className="relative ml-auto">
          <select value={assigneeFilter} onChange={e => setAssignee(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-[10px] font-bold text-[#fefeff] focus:outline-none focus:border-[#e17bd7] cursor-pointer appearance-none pr-7">
            <option value="">Todos</option>
            <option value="Carlos">Carlos Méndez</option>
            <option value="Ana">Ana Rodríguez</option>
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a4a8c0]/50 text-[8px]">▼</span>
        </div>
      </div>

      {/* Groups */}
      {[
        { label: 'Hoy', tasks: grouped.today,    accent: '#e17bd7' },
        { label: 'Mañana', tasks: grouped.tomorrow, accent: '#e4c76a' },
        { label: 'Próximamente', tasks: grouped.later, accent: '#6be1e3' },
        { label: 'Completadas', tasks: grouped.done, accent: '#34d399' },
      ].filter(g => g.tasks.length > 0).map(group => (
        <section key={group.label} className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-extrabold" style={{ color: group.accent }}>{group.label}</span>
            <span className="text-[9px] font-black text-[#a4a8c0]/50">{group.tasks.length}</span>
            <div className="flex-1 h-[1px] bg-white/5" />
          </div>
          <div className="space-y-2">
            {group.tasks.map(t => <TaskRow key={t.id} task={t} onToggle={toggle} />)}
          </div>
        </section>
      ))}

      {visible.length === 0 && (
        <div className="glass-card p-12 rounded-2xl text-center text-[#a4a8c0]/40 text-sm">
          Sin tareas bajo el filtro seleccionado.
        </div>
      )}
    </div>
  );
}
