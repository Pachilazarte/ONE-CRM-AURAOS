// ── Scraper (existing) ────────────────────────────────────────────────────────
export interface Analysis {
  id: string;
  target: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  usersAnalyzed: number;
  maxFollowers?: number;
  usersFound: number;
  progress: number;
  date: string;
  errorMessage?: string;
}

export interface Lead {
  id: string;
  username: string;
  fullname: string | null;
  bio: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  followersCount: number;
  followingCount: number;
  sourceAccount: string;
  scrapedAt: string;
  qualityScore: number;
}

// ── CRM ───────────────────────────────────────────────────────────────────────
export type DealStage = 'nuevo' | 'contactado' | 'interesado' | 'propuesta' | 'negociacion' | 'ganado' | 'perdido';
export type ContactStatus = 'cold' | 'warm' | 'hot';
export type TaskPriority = 'low' | 'medium' | 'high';
export type UserRole = 'admin' | 'vendedor';

export interface CRMContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: ContactStatus;
  leadScore: number;
  assignedTo: string;
  lastActivity?: string;
  createdAt: string;
  source?: string;
}

export interface Deal {
  id: string;
  contactName: string;
  contactId: string;
  amount: number;
  stage: DealStage;
  probability: number;
  assignedTo: string;
  expectedClose: string;
  createdAt: string;
  notes?: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  contactName?: string;
  contactId?: string;
  assignedTo: string;
  completed: boolean;
  priority: TaskPriority;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  body: string;
  date: string;
}

export interface EmailThread {
  id: string;
  contactName: string;
  contactEmail: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
  direction: 'in' | 'out';
  messages: EmailMessage[];
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  lastActivity?: string;
  leadsAssigned?: number;
}

export interface MockSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

/** @deprecated USER_ID removed — auth handled by Supabase session */
export const USER_ID  = '';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const DEAL_STAGES: { key: DealStage; label: string; color: string }[] = [
  { key: 'nuevo',       label: 'Nuevo Lead',    color: '#6be1e3' },
  { key: 'contactado',  label: 'Contactado',    color: '#a4a8c0' },
  { key: 'interesado',  label: 'Interesado',    color: '#e4c76a' },
  { key: 'propuesta',   label: 'Propuesta',     color: '#e17bd7' },
  { key: 'negociacion', label: 'Negociación',   color: '#b673df' },
  { key: 'ganado',      label: 'Ganado ✓',      color: '#34d399' },
  { key: 'perdido',     label: 'Perdido ✗',     color: '#ef4444' },
];
