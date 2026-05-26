'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users, Search, RefreshCcw, Download, Mail, Phone,
  ExternalLink, Tag, FileSpreadsheet, ChevronLeft, ChevronRight,
  Plus, Upload, X, CheckCircle, AlertCircle, Loader2, UserPlus, FileUp,
  Send, BookOpen, Pen, CheckSquare, Square,
} from 'lucide-react';
import type { Lead, PaginatedResponse } from '@/lib/types';
import { API_BASE } from '@/lib/types';

// ── helpers ──────────────────────────────────

function QualityHUD({ score }: { score: number }) {
  const bars = Math.ceil(score / 20);
  const color =
    score >= 70 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' :
    score >= 40 ? 'bg-[#e4c76a] shadow-[0_0_8px_#e4c76a]' :
                  'bg-red-500 shadow-[0_0_8px_#ef4444]';
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-0.5 bg-black/40 p-1 rounded border border-white/5">
        {[1,2,3,4,5].map(b => (
          <div key={b} className={`w-2.5 h-4 rounded-[1px] transition-all ${b <= bars ? color : 'bg-white/5'}`} />
        ))}
      </div>
      <span className="text-[9px] font-extrabold tracking-wider text-[#a4a8c0]">{score}%</span>
    </div>
  );
}

// ── types ─────────────────────────────────────

interface Campaign { id: string; name: string; subject: string; html?: string; }
type ModalTab  = 'manual' | 'csv';
type EmailTab  = 'manual' | 'plantilla';
type EmailMode = 'single' | 'bulk';

interface ManualForm { name: string; email: string; phone: string; company: string; source: string; notes: string; }
const EMPTY_FORM: ManualForm = { name:'', email:'', phone:'', company:'', source:'manual', notes:'' };

const PAGE_LIMIT = 50;

export default function ProspectosPage() {
  // ── data ──
  const [leads, setLeads]             = useState<Lead[]>([]);
  const [loading, setLoading]         = useState(true);
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(0);
  const [totalLeads, setTotalLeads]   = useState(0);

  // ── filters ──
  const [searchQuery, setSearchQuery]       = useState('');
  const [filterSource, setFilterSource]     = useState('');
  const [filterOnlyPhone, setFilterOnlyPhone] = useState(false);
  const [sources, setSources]               = useState<string[]>([]);
  const [isDeleting, setIsDeleting]         = useState(false);

  // ── export ──
  const [isDownloadingCSV, setIsDownloadingCSV]     = useState(false);
  const [isDownloadingExcel, setIsDownloadingExcel] = useState(false);

  // ── selection ──
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── load modal ──
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [loadTab, setLoadTab]     = useState<ModalTab>('manual');
  const [saving, setSaving]       = useState(false);
  const [saveResult, setSaveResult] = useState<{ok:boolean;msg:string}|null>(null);
  const [form, setForm]           = useState<ManualForm>(EMPTY_FORM);
  const fileRef                   = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows]     = useState<Record<string,string>[]>([]);
  const [csvError, setCsvError]   = useState('');
  const [csvFileName, setCsvFileName] = useState('');

  // ── email modal ──
  const [showEmailModal, setShowEmailModal]   = useState(false);
  const [emailMode, setEmailMode]             = useState<EmailMode>('single');
  const [emailTargets, setEmailTargets]       = useState<Lead[]>([]);
  const [emailTab, setEmailTab]               = useState<EmailTab>('manual');
  const [campaigns, setCampaigns]             = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [emailSubject, setEmailSubject]       = useState('');
  const [emailBody, setEmailBody]             = useState('');
  const [emailSending, setEmailSending]       = useState(false);
  const [emailResult, setEmailResult]         = useState<{ok:boolean;msg:string}|null>(null);

  // ── fetch ──────────────────────────────────
  const fetchLeads = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_LIMIT) });
    if (filterSource) params.set('sourceAccount', filterSource);
    if (filterOnlyPhone) params.set('phone', 'true');
    fetch(`${API_BASE}/leads?${params}`)
      .then(r => r.json())
      .then((res: PaginatedResponse<Lead> | Lead[]) => {
        if (Array.isArray(res)) { setLeads(res); setTotalLeads(res.length); setTotalPages(1); }
        else { setLeads(res.data||[]); setTotalLeads(res.total||0); setTotalPages(res.totalPages||1); }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, filterSource, filterOnlyPhone]);

  const fetchSources = useCallback(() => {
    fetch(`${API_BASE}/leads/sources`)
      .then(r => r.json())
      .then(d => setSources(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLeads();
    fetchSources();
    const t = setInterval(() => {
      fetchLeads();
      fetchSources();
    }, 15000);
    return () => clearInterval(t);
  }, [fetchLeads, fetchSources]);

  useEffect(() => { setPage(1); setSelected(new Set()); }, [filterSource, filterOnlyPhone]);

  const fetchCampaigns = useCallback(() => {
    fetch(`${API_BASE}/campaigns`).then(r => r.json()).then(d => setCampaigns(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const handleDeleteSelected = async () => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar ${selectionCount} prospectos?`)) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/leads/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (res.ok) {
        setSelected(new Set());
        fetchLeads();
        fetchSources();
      } else {
        alert('Error al eliminar los prospectos');
      }
    } catch (err) {
      alert('Error de red al eliminar');
    } finally {
      setIsDeleting(false);
    }
  };

  const uniqueSources = Array.from(new Set(leads.map(l => l.sourceAccount).filter(Boolean)));
  const filtered = leads.filter(lead => {
    const q = searchQuery.toLowerCase();
    return (lead.username||'').toLowerCase().includes(q) ||
      (lead.fullname||'').toLowerCase().includes(q) ||
      (lead.email||'').toLowerCase().includes(q) ||
      (lead.category||'').toLowerCase().includes(q);
  });

  // ── selection helpers ──────────────────────
  const toggleOne = (id: string) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const toggleAll = () =>
    setSelected(prev => prev.size === filtered.length ? new Set() : new Set(filtered.map(l => l.id)));

  // ── email modal helpers ────────────────────
  const openEmailModal = (mode: EmailMode, lead?: Lead) => {
    setEmailMode(mode);
    setEmailTargets(mode === 'single' && lead ? [lead] : filtered.filter(l => selected.has(l.id)));
    setEmailTab('manual');
    setEmailSubject('');
    setEmailBody('');
    setSelectedCampaign('');
    setEmailResult(null);
    fetchCampaigns();
    setShowEmailModal(true);
  };

  const handleCampaignSelect = (id: string) => {
    setSelectedCampaign(id);
    const c = campaigns.find(c => c.id === id);
    if (c) { setEmailSubject(c.subject); setEmailBody(c.html || ''); }
  };

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    setEmailResult(null);
    try {
      if (emailMode === 'single' && emailTargets[0]) {
        const res = await fetch(`${API_BASE}/emails/send`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: emailTargets[0].email, subject: emailSubject, html: emailBody }),
        });
        const d = await res.json();
        setEmailResult(res.ok ? { ok: true, msg: 'Email enviado.' } : { ok: false, msg: d.error || 'Error.' });
      } else {
        const contacts = emailTargets.map(l => ({ email: l.email!, name: l.fullname || l.username }));
        const res = await fetch(`${API_BASE}/campaigns`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject: emailSubject, html: emailBody, contacts }),
        });
        const d = await res.json();
        setEmailResult(res.ok
          ? { ok: true, msg: `Campaña creada. Enviando a ${contacts.length} leads...` }
          : { ok: false, msg: d.error || 'Error.' });
      }
    } catch { setEmailResult({ ok: false, msg: 'Error de red.' }); }
    setEmailSending(false);
  };

  // ── CSV parser ─────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setCsvFileName(file.name); setCsvError(''); setCsvRows([]);
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvError('Archivo vacío.'); return; }
        const headers = lines[0].split(',').map(h => h.replace(/^["']|["']$/g,'').trim().toLowerCase());
        const rows = lines.slice(1)
          .map(line => {
            const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? line.split(',');
            const obj: Record<string,string> = {};
            headers.forEach((h,i) => { obj[h] = (vals[i]??'').replace(/^["']|["']$/g,'').trim(); });
            return obj;
          })
          .filter(r => Object.values(r).some(v => v));
        if (!rows.length) { setCsvError('Sin datos.'); return; }
        setCsvRows(rows);
      } catch { setCsvError('Error al leer el CSV.'); }
    };
    reader.readAsText(file, 'utf-8');
  };

  const normalizeRow = (r: Record<string,string>) => ({
    email:   r.email||r.correo||r['e-mail']||r.mail||'',
    name:    r.name||r.nombre||r['nombre completo']||r.fullname||r.full_name||'',
    phone:   r.phone||r.telefono||r.teléfono||r.tel||r.celular||'',
    company: r.company||r.empresa||r.categoria||r.category||'',
    source:  r.source||r.origen||r.source_account||'manual',
    notes:   r.notes||r.notas||'',
  });

  const handleSaveLead = async () => {
    setSaving(true); setSaveResult(null);
    try {
      let leads: object[];
      if (loadTab === 'manual') {
        if (!form.email.trim() || !form.email.includes('@')) { setSaveResult({ok:false,msg:'Email requerido.'}); setSaving(false); return; }
        leads = [form];
      } else {
        const valid = csvRows.map(normalizeRow).filter(r => r.email.includes('@'));
        if (!valid.length) { setSaveResult({ok:false,msg:'No se encontraron emails válidos.'}); setSaving(false); return; }
        leads = valid;
      }
      const res = await fetch(`${API_BASE}/leads`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({leads}),
      });
      const d = await res.json();
      if (!res.ok) { setSaveResult({ok:false,msg:d.error||'Error.'}); }
      else {
        setSaveResult({ok:true,msg:`${d.inserted} agregado${d.inserted!==1?'s':''}${d.skipped>0?` · ${d.skipped} duplicado${d.skipped!==1?'s':''} omitido${d.skipped!==1?'s':''}`:''}.`});
        fetchLeads();
        if (loadTab==='manual') setForm(EMPTY_FORM);
        else { setCsvRows([]); setCsvFileName(''); if (fileRef.current) fileRef.current.value=''; }
      }
    } catch { setSaveResult({ok:false,msg:'Error de red.'}); }
    setSaving(false);
  };

  const openLoadModal = (tab: ModalTab) => {
    setLoadTab(tab); setForm(EMPTY_FORM); setCsvRows([]); setCsvFileName(''); setCsvError('');
    setSaveResult(null); setShowLoadModal(true);
  };

  // ── exports ────────────────────────────────
  const handleExportCSV = () => {
    if (!filtered.length) return;
    setIsDownloadingCSV(true);
    const h = ['Username','Nombre','Email','Teléfono','Web','Categoría','Seguidores','Origen','Score','Fecha'];
    const rows = filtered.map(l => [
      l.username,l.fullname||'',l.email||'',l.phone||'',
      l.website||'',l.category||'',l.followersCount,l.sourceAccount,l.qualityScore,
      l.scrapedAt?new Date(l.scrapedAt).toLocaleDateString():'',
    ]);
    const csv = [h.join(','),...rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download=`prospectos_${Date.now()}.csv`; a.click(); setIsDownloadingCSV(false);
  };

  const handleExportExcel = () => {
    if (!filtered.length) return;
    setIsDownloadingExcel(true);
    const h = ['Username','Nombre Completo','Email','Teléfono','Sitio Web','Categoría','Seguidores','Cuenta Origen','Calidad','Extraído En'];
    let xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Prospectos"><Table>`;
    xml += '<Row>'+h.map(hh=>`<Cell><ss:Data ss:Type="String">${hh}</ss:Data></Cell>`).join('')+'</Row>';
    filtered.forEach(l => {
      xml += '<Row>';
      [`@${l.username}`,l.fullname||'',l.email||'',l.phone||'',l.website||'',l.category||''].forEach(v=>{xml+=`<Cell><ss:Data ss:Type="String">${v}</ss:Data></Cell>`;});
      xml+=`<Cell><ss:Data ss:Type="Number">${l.followersCount}</ss:Data></Cell>`;
      xml+=`<Cell><ss:Data ss:Type="String">${l.sourceAccount}</ss:Data></Cell>`;
      xml+=`<Cell><ss:Data ss:Type="Number">${l.qualityScore}</ss:Data></Cell>`;
      xml+=`<Cell><ss:Data ss:Type="String">${l.scrapedAt?.substring(0,10)||''}</ss:Data></Cell>`;
      xml += '</Row>';
    });
    xml += '</Table></Worksheet></Workbook>';
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([xml],{type:'application/vnd.ms-excel'}));
    a.download=`prospectos_${Date.now()}.xls`; a.click(); setIsDownloadingExcel(false);
  };

  const selectionCount = selected.size;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-6 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#e17bd7]/4 blur-[120px] rounded-full -mr-40 -mt-40 pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold font-exo flex items-center gap-2">
            <Users size={22} className="text-[#e17bd7]" />Prospectos
          </h1>
          <p className="text-xs text-[#a4a8c0] mt-0.5">
            {loading ? '...' : `${filtered.length} de ${totalLeads} leads`} · solo con email verificado
            {selectionCount > 0 && <span className="ml-2 text-[#e17bd7] font-bold">· {selectionCount} seleccionados</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openLoadModal('manual')}
            className="btn-one flex items-center gap-2 py-2.5 px-4 text-[10px] uppercase tracking-widest font-black">
            <UserPlus size={12} />Agregar Lead
          </button>
          <button type="button" onClick={() => openLoadModal('csv')}
            className="flex items-center gap-2 py-2.5 px-4 text-[10px] uppercase tracking-widest font-black rounded-xl border border-[#6be1e3]/30 text-[#6be1e3] hover:bg-[#6be1e3]/10 transition-all">
            <FileUp size={12} />Importar CSV
          </button>
          <button type="button" onClick={handleExportExcel} disabled={!filtered.length||isDownloadingExcel}
            className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black transition-all font-extrabold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-20">
            {isDownloadingExcel?<RefreshCcw className="animate-spin" size={13}/>:<FileSpreadsheet size={13}/>}Excel
          </button>
          <button type="button" onClick={handleExportCSV} disabled={!filtered.length||isDownloadingCSV}
            className="bg-[#e17bd7]/10 border border-[#e17bd7]/30 text-[#e17bd7] hover:bg-[#e17bd7] hover:text-black transition-all font-extrabold text-[10px] uppercase tracking-wider px-4 py-2.5 rounded-xl flex items-center gap-2 disabled:opacity-20">
            {isDownloadingCSV?<RefreshCcw className="animate-spin" size={13}/>:<Download size={13}/>}CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-2xl flex flex-col lg:flex-row gap-4 items-center border-white/5">
        <div className="relative flex-1 w-full lg:max-w-sm">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#a4a8c0]/60" size={15} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por usuario, email o categoría..."
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all" />
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative">
            <select aria-label="Filtrar por origen" value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-[10px] font-extrabold uppercase text-[#fefeff] focus:outline-none focus:border-[#e17bd7] cursor-pointer appearance-none pr-8">
              <option value="">Todos los orígenes</option>
              {sources.map(s => <option key={s} value={s}>@{s}</option>)}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#a4a8c0]/60 text-[8px]">▼</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[10px] font-extrabold uppercase tracking-wider text-[#a4a8c0]">
            <input type="checkbox" checked={filterOnlyPhone} onChange={e => setFilterOnlyPhone(e.target.checked)}
              className="accent-[#e17bd7] w-4 h-4 cursor-pointer" />
            Con Teléfono
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-2xl border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5 text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0]/60">
                <th className="px-4 py-3.5 w-10">
                  <button type="button" aria-label="Seleccionar todos" onClick={toggleAll}
                    className="text-[#a4a8c0] hover:text-[#e17bd7] transition-colors">
                    {selected.size === filtered.length && filtered.length > 0
                      ? <CheckSquare size={15} className="text-[#e17bd7]" />
                      : <Square size={15} />}
                  </button>
                </th>
                <th className="px-4 py-3.5">Perfil</th>
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Contacto</th>
                <th className="px-4 py-3.5">Categoría</th>
                <th className="px-4 py-3.5 text-center">Calidad</th>
                <th className="px-4 py-3.5">Origen</th>
                <th className="px-4 py-3.5 text-center w-16">Email</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-[#a4a8c0]/40 text-xs">Cargando prospectos...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-16 text-center text-[#a4a8c0]/40 text-xs">Sin prospectos bajo el filtro seleccionado.</td></tr>
              ) : filtered.map(lead => (
                <tr key={lead.id} className={`hover:bg-white/[0.02] transition-all text-xs group ${selected.has(lead.id) ? 'bg-[#e17bd7]/[0.03]' : ''}`}>
                  {/* checkbox */}
                  <td className="px-4 py-3">
                    <button type="button" aria-label="Seleccionar" onClick={() => toggleOne(lead.id)}
                      className="text-[#a4a8c0] hover:text-[#e17bd7] transition-colors">
                      {selected.has(lead.id)
                        ? <CheckSquare size={14} className="text-[#e17bd7]" />
                        : <Square size={14} />}
                    </button>
                  </td>
                  {/* perfil */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gradient-to-tr from-[#e17bd7]/20 to-[#6be1e3]/20 rounded-xl flex items-center justify-center font-black text-[#fefeff] uppercase shrink-0 border border-white/5 text-[10px]">
                        {lead.username.substring(0,2)}
                      </div>
                      <div>
                        <div className="font-extrabold text-[#fefeff] group-hover:text-[#e17bd7] transition-all">@{lead.username}</div>
                        <div className="text-[10px] text-[#a4a8c0] truncate max-w-[160px]">{lead.fullname||'—'}</div>
                      </div>
                    </div>
                  </td>
                  {/* email */}
                  <td className="px-4 py-3">
                    <a href={`mailto:${lead.email}`} className="inline-flex items-center gap-1.5 text-[#6be1e3] font-extrabold hover:underline text-xs">
                      <Mail size={11}/>{lead.email}
                    </a>
                  </td>
                  {/* contacto */}
                  <td className="px-4 py-3 space-y-1">
                    {lead.phone && (
                      <div className="flex items-center gap-1.5 font-extrabold text-[#fefeff]">
                        <Phone size={11} className="text-[#e4c76a]"/>{lead.phone}
                      </div>
                    )}
                    {lead.website && (
                      <a href={lead.website.startsWith('http')?lead.website:`https://${lead.website}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-[#a4a8c0] hover:text-[#fefeff] hover:underline">
                        <ExternalLink size={9}/>Sitio web
                      </a>
                    )}
                    {!lead.phone && !lead.website && <span className="text-[#a4a8c0]/20">—</span>}
                  </td>
                  {/* categoría */}
                  <td className="px-4 py-3">
                    {lead.category
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-white/5 text-[#c6c9d7] border border-white/5"><Tag size={8}/>{lead.category}</span>
                      : <span className="text-[#a4a8c0]/20">—</span>}
                  </td>
                  {/* calidad */}
                  <td className="px-4 py-3 text-center"><QualityHUD score={lead.qualityScore}/></td>
                  {/* origen */}
                  <td className="px-4 py-3">
                    <span className="text-[10px] font-extrabold text-[#e17bd7] bg-[#e17bd7]/5 px-2 py-0.5 rounded-lg border border-[#e17bd7]/10">@{lead.sourceAccount}</span>
                  </td>
                  {/* email button */}
                  <td className="px-4 py-3 text-center">
                    <button type="button" aria-label={`Enviar email a ${lead.username}`}
                      onClick={() => openEmailModal('single', lead)}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-[#e17bd7]/20 border border-white/5 hover:border-[#e17bd7]/30 flex items-center justify-center mx-auto transition-all group/btn">
                      <Send size={11} className="text-[#a4a8c0] group-hover/btn:text-[#e17bd7] transition-colors"/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button type="button" onClick={() => setPage(p => Math.max(1,p-1))} disabled={page<=1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-[#a4a8c0] hover:text-[#fefeff] hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
              <ChevronLeft size={12}/> Anterior
            </button>
            <span className="text-[10px] font-extrabold text-[#a4a8c0]">Página <span className="text-[#e17bd7]">{page}</span> de {totalPages}</span>
            <button type="button" onClick={() => setPage(p => Math.min(totalPages,p+1))} disabled={page>=totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase tracking-wider text-[#a4a8c0] hover:text-[#fefeff] hover:bg-white/5 transition-all disabled:opacity-20 disabled:cursor-not-allowed">
              Siguiente <ChevronRight size={12}/>
            </button>
          </div>
        )}
      </div>

      {/* ── Floating action bar (when selection > 0) ── */}
      {selectionCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0e0e12]/95 border border-[#e17bd7]/30 shadow-2xl backdrop-blur-xl">
          <span className="text-xs font-extrabold text-[#fefeff]">
            <span className="text-[#e17bd7]">{selectionCount}</span> seleccionado{selectionCount!==1?'s':''}
          </span>
          <div className="w-px h-4 bg-white/10"/>
          <button type="button" onClick={() => openEmailModal('bulk')}
            className="btn-one flex items-center gap-2 py-2 px-4 text-[10px] uppercase tracking-widest font-black">
            <Send size={11}/>Enviar email masivo
          </button>
          <button type="button" onClick={handleDeleteSelected} disabled={isDeleting}
            className="flex items-center gap-2 py-2 px-4 text-[10px] uppercase tracking-widest font-black rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-50">
            {isDeleting ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
            Eliminar Seleccionados
          </button>
          <button type="button" aria-label="Deseleccionar todos" onClick={() => setSelected(new Set())}
            className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors p-1">
            <X size={14}/>
          </button>
        </div>
      )}

      {/* ══════════ EMAIL MODAL ══════════ */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

            {/* header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
              <div>
                <h2 className="text-base font-extrabold font-exo flex items-center gap-2">
                  <Mail size={16} className="text-[#e17bd7]"/>
                  {emailMode === 'single' ? `Email a @${emailTargets[0]?.username}` : `Email masivo · ${emailTargets.length} leads`}
                </h2>
                {emailMode === 'single' && (
                  <p className="text-[10px] text-[#6be1e3] mt-0.5">{emailTargets[0]?.email}</p>
                )}
              </div>
              <button type="button" aria-label="Cerrar" onClick={() => setShowEmailModal(false)}
                className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors">
                <X size={18}/>
              </button>
            </div>

            {/* tabs */}
            <div className="flex px-6 pt-4 gap-1">
              {(['manual','plantilla'] as EmailTab[]).map(t => (
                <button key={t} type="button" onClick={() => setEmailTab(t)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-t-xl border-b-2 transition-all ${
                    emailTab===t ? 'border-[#e17bd7] text-[#e17bd7] bg-[#e17bd7]/5' : 'border-transparent text-[#a4a8c0] hover:text-[#fefeff]'
                  }`}>
                  {t==='manual' ? <><Pen size={11}/>Manual</> : <><BookOpen size={11}/>Usar plantilla</>}
                </button>
              ))}
            </div>

            <div className="px-6 pb-6 pt-5 space-y-4">

              {/* plantilla picker */}
              {emailTab === 'plantilla' && (
                <div className="space-y-1.5">
                  <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Seleccionar campaña</label>
                  {campaigns.length === 0 ? (
                    <p className="text-xs text-[#a4a8c0]/50">No hay campañas guardadas aún.</p>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {campaigns.map(c => (
                        <button key={c.id} type="button" onClick={() => handleCampaignSelect(c.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                            selectedCampaign===c.id
                              ? 'border-[#e17bd7]/40 bg-[#e17bd7]/10 text-[#fefeff]'
                              : 'border-white/10 bg-black/30 text-[#a4a8c0] hover:border-white/20 hover:text-[#fefeff]'
                          }`}>
                          <div className="font-extrabold">{c.name || c.subject}</div>
                          <div className="text-[10px] mt-0.5 opacity-60">Asunto: {c.subject}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* subject */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Asunto *</label>
                <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Ej: Propuesta de colaboración"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"/>
              </div>

              {/* body */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">
                  Cuerpo *
                  {emailMode==='bulk' && <span className="ml-2 font-normal normal-case text-[#a4a8c0]/60">usá {`{{name}}`} para personalizar</span>}
                </label>
                <textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={6}
                  placeholder="<p>Hola{{name ? ` ${name}` : ''}},</p><p>...</p>"
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-mono resize-none focus:outline-none focus:border-[#e17bd7] transition-all"/>
              </div>

              {/* result */}
              {emailResult && (
                <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2.5 border ${
                  emailResult.ok
                    ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                    : 'text-red-400 bg-red-500/10 border-red-500/20'
                }`}>
                  {emailResult.ok ? <CheckCircle size={13}/> : <AlertCircle size={13}/>}
                  {emailResult.msg}
                </div>
              )}

              {/* actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowEmailModal(false)}
                  className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0] hover:text-[#fefeff] transition-colors">
                  Cerrar
                </button>
                <button type="button" onClick={handleSendEmail}
                  disabled={emailSending||!emailSubject.trim()||!emailBody.trim()}
                  className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black disabled:opacity-30">
                  {emailSending ? <Loader2 size={12} className="animate-spin"/> : <Send size={12}/>}
                  {emailSending ? 'Enviando...' : emailMode==='single' ? 'Enviar' : `Enviar a ${emailTargets.length} leads`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ LOAD MODAL ══════════ */}
      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-xl glass-card rounded-2xl border border-white/10 shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 pt-5 pb-0">
              <h2 className="text-base font-extrabold font-exo flex items-center gap-2">
                <Plus size={16} className="text-[#e17bd7]"/>Carga de Leads
              </h2>
              <button type="button" aria-label="Cerrar" onClick={() => setShowLoadModal(false)}
                className="text-[#a4a8c0] hover:text-[#fefeff] transition-colors"><X size={18}/></button>
            </div>

            <div className="flex px-6 pt-4">
              {(['manual','csv'] as ModalTab[]).map(t => (
                <button key={t} type="button" onClick={() => { setLoadTab(t); setSaveResult(null); }}
                  className={`flex items-center gap-1.5 px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest rounded-t-xl border-b-2 transition-all ${
                    loadTab===t ? 'border-[#e17bd7] text-[#e17bd7] bg-[#e17bd7]/5' : 'border-transparent text-[#a4a8c0] hover:text-[#fefeff]'
                  }`}>
                  {t==='manual' ? <><UserPlus size={11}/>Manual</> : <><FileUp size={11}/>Importar CSV</>}
                </button>
              ))}
            </div>

            <div className="px-6 pb-6 pt-5 space-y-4">
              {loadTab === 'manual' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    {([['name','Nombre','Juan García'],['email','Email *','juan@empresa.com'],['phone','Teléfono','+54 9 11 1234 5678'],['company','Empresa / Rubro','Consultora RRHH']] as const).map(([k,l,ph]) => (
                      <div key={k} className="space-y-1">
                        <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">{l}</label>
                        <input value={form[k as keyof ManualForm]} onChange={e => setForm(f=>({...f,[k]:e.target.value}))}
                          placeholder={ph} type={k==='email'?'email':'text'}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"/>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Origen</label>
                    <input value={form.source} onChange={e => setForm(f=>({...f,source:e.target.value}))} placeholder="manual, evento, referido..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold focus:outline-none focus:border-[#e17bd7] transition-all"/>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-extrabold uppercase tracking-widest text-[#a4a8c0]">Notas</label>
                    <textarea value={form.notes} onChange={e => setForm(f=>({...f,notes:e.target.value}))} rows={2} placeholder="Info adicional..."
                      className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-[#fefeff] font-semibold resize-none focus:outline-none focus:border-[#e17bd7] transition-all"/>
                  </div>
                </div>
              )}

              {loadTab === 'csv' && (
                <div className="space-y-4">
                  <div className="text-[10px] text-[#a4a8c0] bg-black/30 rounded-xl p-3 border border-white/5">
                    Columna requerida: <span className="text-[#6be1e3] font-bold">email</span> · Opcionales: nombre, telefono, empresa, origen, notas
                  </div>
                  <label className={`flex flex-col items-center justify-center gap-3 w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    csvRows.length>0 ? 'border-[#6be1e3]/40 bg-[#6be1e3]/5' : 'border-white/10 hover:border-[#e17bd7]/40 hover:bg-[#e17bd7]/5'
                  }`}>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange}/>
                    {csvRows.length>0 ? (
                      <><CheckCircle size={22} className="text-[#6be1e3]"/>
                        <div className="text-center"><div className="text-xs font-extrabold text-[#6be1e3]">{csvFileName}</div>
                          <div className="text-[10px] text-[#a4a8c0]">{csvRows.length} filas</div></div></>
                    ) : (
                      <><Upload size={22} className="text-[#a4a8c0]/40"/>
                        <div className="text-xs text-[#a4a8c0]">Clic para subir CSV</div></>
                    )}
                  </label>
                  {csvError && <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2"><AlertCircle size={12}/>{csvError}</div>}
                  {csvRows.length>0 && (
                    <div className="text-[10px] text-[#a4a8c0] bg-black/30 rounded-xl p-3 border border-white/5">
                      Vista previa:
                      {csvRows.slice(0,3).map((r,i) => { const n=normalizeRow(r); return (
                        <div key={i} className="mt-1 text-[#fefeff]/70">{n.email||<span className="text-red-400">sin email</span>}{n.name&&<span className="text-[#a4a8c0]"> · {n.name}</span>}</div>
                      );})}
                    </div>
                  )}
                </div>
              )}

              {saveResult && (
                <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2.5 border ${saveResult.ok?'text-emerald-400 bg-emerald-500/10 border-emerald-500/20':'text-red-400 bg-red-500/10 border-red-500/20'}`}>
                  {saveResult.ok?<CheckCircle size={13}/>:<AlertCircle size={13}/>}{saveResult.msg}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setShowLoadModal(false)}
                  className="px-4 py-2 text-[10px] font-extrabold uppercase tracking-widest text-[#a4a8c0] hover:text-[#fefeff] transition-colors">Cerrar</button>
                <button type="button" onClick={handleSaveLead}
                  disabled={saving||(loadTab==='manual'&&!form.email.trim())||(loadTab==='csv'&&csvRows.length===0)}
                  className="btn-one flex items-center gap-2 py-2.5 px-5 text-[10px] uppercase tracking-widest font-black disabled:opacity-30">
                  {saving?<Loader2 size={12} className="animate-spin"/>:<Plus size={12}/>}
                  {saving?'Guardando...':loadTab==='manual'?'Agregar Lead':`Importar ${csvRows.length>0?csvRows.length:''} Leads`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
