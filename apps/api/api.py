"""
Instagram Lead Scraper — Python API (v2 — Supabase backend)
"""

import os
from dotenv import load_dotenv

dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
load_dotenv(dotenv_path=dotenv_path)

from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess, json, uuid, csv, sys, time, threading, queue
from pathlib import Path
from datetime import datetime
import resend
from postgrest import SyncPostgrestClient
from pydantic import BaseModel, field_validator, ValidationError

app = Flask(__name__)
CORS(app)

BASE_DIR    = Path(__file__).parent
SCRAPER_DIR = BASE_DIR.parent / "scraper"
JOBS_FILE   = BASE_DIR / "jobs.json"
CAMPAIGNS_FILE = BASE_DIR / "campaigns.json"
PYTHON      = sys.executable

resend.api_key = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM    = os.environ.get("RESEND_FROM", "onboarding@resend.dev")

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL   = os.environ.get("OPENROUTER_MODEL", "openrouter/owl-alpha")

# ── Supabase client (PostgREST only — no storage dependency) ──
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
_sb = None

def get_sb() -> SyncPostgrestClient:
    global _sb
    if _sb is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        _sb = SyncPostgrestClient(
            f"{SUPABASE_URL}/rest/v1",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            },
        )
    return _sb

USE_SUPABASE = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)


# ── Pydantic models ──────────────────────────

class StartScrapingRequest(BaseModel):
    sourceAccount: str
    maxFollowers: int = 100
    resetCursor: bool = False
    hibernate: bool = False
    usernames: str = ""

    @field_validator("sourceAccount")
    @classmethod
    def clean(cls, v):
        v = v.strip().lstrip("@")
        if not v:
            raise ValueError("sourceAccount is required")
        return v

class SendEmailRequest(BaseModel):
    to: str
    subject: str
    html: str

class CreateCampaignRequest(BaseModel):
    name: str = ""
    subject: str
    html: str
    contacts: list


# ── Legacy JSON helpers (fallback when Supabase not configured) ──

def load_jobs() -> dict:
    if not JOBS_FILE.exists():
        return {}
    with open(JOBS_FILE, encoding="utf-8") as f:
        return json.load(f)

def save_jobs(jobs: dict):
    with open(JOBS_FILE, "w", encoding="utf-8") as f:
        json.dump(jobs, f, indent=2, ensure_ascii=False)

def count_leads(output_file: Path) -> int:
    if not output_file.exists():
        return 0
    with open(output_file, encoding="utf-8") as f:
        return max(0, sum(1 for _ in csv.DictReader(f)))

def load_campaigns() -> dict:
    if not CAMPAIGNS_FILE.exists():
        return {}
    with open(CAMPAIGNS_FILE, encoding="utf-8") as f:
        return json.load(f)

def save_campaigns(c: dict):
    with open(CAMPAIGNS_FILE, "w", encoding="utf-8") as f:
        json.dump(c, f, indent=2, ensure_ascii=False)


# ── Scraper Queue and Concurrency Manager ──

scraper_queue = queue.Queue()
queue_lock = threading.Lock()
is_queue_worker_running = False

def api_queue_worker():
    global is_queue_worker_running
    print("API Scraper Queue Worker started.")
    while True:
        try:
            try:
                # Wait up to 5 seconds for a job
                job_args = scraper_queue.get(timeout=5)
            except queue.Empty:
                with queue_lock:
                    if scraper_queue.empty():
                        is_queue_worker_running = False
                        print("API Scraper Queue Worker stopped (queue empty).")
                        break
                continue
                
            job_id, source_account, max_followers, output_file, reset, hibernate, usernames = job_args
            print(f"Queue Worker: Processing job {job_id} for @{source_account}")
            
            # Execute scraper synchronously in this queue worker thread
            run_scraper(job_id, source_account, max_followers, output_file, reset, hibernate, usernames)
            
            scraper_queue.task_done()
        except Exception as e:
            print(f"Error in API Scraper Queue Worker: {e}", file=sys.stderr)


# ── Scraper runner (synchronous worker task execution) ──

def run_scraper(job_id: str, source_account: str, max_followers: int, output_file: Path, reset: bool = False, hibernate: bool = False, usernames: str = ""):
    if USE_SUPABASE:
        sb = get_sb()
        # Verify the job is still pending before executing to avoid double-processing with worker.py
        resp = sb.from_("scraper_jobs").select("status").eq("id", job_id).execute()
        if resp.data and resp.data[0].get("status") != "pending":
            print(f"⚠️ [api.py] Skipping local queue worker execution for job {job_id[:8]} because it is already processed/running (status: {resp.data[0].get('status')})", flush=True)
            return
        sb.from_("scraper_jobs").update({"status": "running", "started_at": datetime.now().isoformat()}).eq("id", job_id).execute()
    else:
        jobs = load_jobs()
        jobs[job_id]["status"] = "processing"
        save_jobs(jobs)

    known_emails: set[str] = set()
    if USE_SUPABASE:
        try:
            resp = get_sb().from_("contacts").select("email").execute()
            for r in (resp.data or []):
                e = (r.get("email") or "").strip().lower()
                if e:
                    known_emails.add(e)
        except Exception as e:
            print(f"Error querying contacts email for deduplication: {e}", file=sys.stderr)

    for f in SCRAPER_DIR.glob("leads_*.csv"):
        try:
            with open(f, encoding="utf-8") as fp:
                for row in csv.DictReader(fp):
                    email = (row.get("email") or "").strip().lower()
                    if email:
                        known_emails.add(email)
        except Exception:
            pass
    known_emails_file = SCRAPER_DIR / "known_emails.json"
    with open(known_emails_file, "w", encoding="utf-8") as fp:
        json.dump(list(known_emails), fp)

    cmd = [
        PYTHON, str(SCRAPER_DIR / "scraper.py"),
        "--target", source_account,
        "--max-followers", str(max_followers),
        "--output", str(output_file),
        "--known-emails", str(known_emails_file)
    ]
    if reset:
        cmd.append("--reset-cursor")
    if job_id:
        cmd.extend(["--job-id", job_id])
    if hibernate:
        cmd.append("--hibernate")
    if usernames:
        cmd.extend(["--usernames", usernames])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True, text=True,
            cwd=str(SCRAPER_DIR),
        )
        leads_found = count_leads(output_file)
        if USE_SUPABASE:
            sb = get_sb()
            updates = {"status": "done" if result.returncode == 0 else "error",
                       "finished_at": datetime.now().isoformat(),
                       "leads_found": leads_found}
            if result.returncode != 0:
                updates["error_message"] = (result.stderr or "Unknown error")[-500:]
            sb.from_("scraper_jobs").update(updates).eq("id", job_id).execute()
        else:
            jobs = load_jobs()
            if result.returncode == 0:
                jobs[job_id]["status"] = "completed"
            else:
                jobs[job_id]["status"] = "failed"
                jobs[job_id]["errorMessage"] = (result.stderr or "Unknown error")[-500:]
            save_jobs(jobs)
    except Exception as e:
        if USE_SUPABASE:
            get_sb().from_("scraper_jobs").update({"status": "error", "error_message": str(e), "finished_at": datetime.now().isoformat()}).eq("id", job_id).execute()
        else:
            jobs = load_jobs()
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["errorMessage"] = str(e)
            save_jobs(jobs)


# ── Campaign sender (background thread) ──

BATCH_SIZE  = 10
BATCH_DELAY = 1.0

def run_campaign(campaign_id: str):
    if USE_SUPABASE:
        _run_campaign_supabase(campaign_id)
    else:
        _run_campaign_json(campaign_id)

def _run_campaign_supabase(campaign_id: str):
    sb = get_sb()
    sb.from_("campaigns").update({"status": "sending", "started_at": datetime.now().isoformat()}).eq("id", campaign_id).execute()
    contacts_resp = sb.from_("campaign_contacts").select("*").eq("campaign_id", campaign_id).execute()
    contacts = contacts_resp.data or []
    sent = failed = 0
    camp_resp = sb.from_("campaigns").select("subject, html").eq("id", campaign_id).execute()
    camp = camp_resp.data[0] if camp_resp.data else {}

    def replace_vars(text: str, c: dict) -> str:
        if not text: return ""
        for k, v in c.items():
            if v is not None:
                text = text.replace(f"{{{{{k}}}}}", str(v))
        # Default empty for missing ones
        import re
        return re.sub(r'\{\{.*?\}\}', '', text)

    for i in range(0, len(contacts), BATCH_SIZE):
        batch = contacts[i:i+BATCH_SIZE]
        for c in batch:
            try:
                subj = replace_vars(camp.get("subject", ""), c)
                body = replace_vars(camp.get("html", ""), c)
                resend.Emails.send({"from": RESEND_FROM, "to": c["email"], "subject": subj, "html": body})
                sb.from_("campaign_contacts").update({"status": "sent", "sent_at": datetime.now().isoformat()}).eq("id", c["id"]).execute()
                sent += 1
            except Exception as e:
                sb.from_("campaign_contacts").update({"status": "failed", "error": str(e)[:120]}).eq("id", c["id"]).execute()
                failed += 1
        sb.from_("campaigns").update({"sent": sent, "failed": failed}).eq("id", campaign_id).execute()
        if i + BATCH_SIZE < len(contacts):
            time.sleep(BATCH_DELAY)

    sb.from_("campaigns").update({"status": "done", "finished_at": datetime.now().isoformat(), "sent": sent, "failed": failed}).eq("id", campaign_id).execute()

def _run_campaign_json(campaign_id: str):
    campaigns = load_campaigns()
    camp = campaigns[campaign_id]
    camp["status"] = "sending"
    camp["startedAt"] = datetime.now().isoformat()
    save_campaigns(campaigns)
    contacts = camp["contacts"]
    sent = failed = 0

    def replace_vars(text: str, c: dict) -> str:
        if not text: return ""
        for k, v in c.items():
            if v is not None:
                text = text.replace(f"{{{{{k}}}}}", str(v))
        import re
        return re.sub(r'\{\{.*?\}\}', '', text)
    for i in range(0, len(contacts), BATCH_SIZE):
        batch = contacts[i:i+BATCH_SIZE]
        for contact in batch:
            try:
                subj = replace_vars(camp.get("subject", ""), contact)
                body = replace_vars(camp.get("html", ""), contact)
                resend.Emails.send({"from": RESEND_FROM, "to": contact["email"], "subject": subj, "html": body})
                contact["status"] = "sent"
                sent += 1
            except Exception as e:
                contact["status"] = "failed"
                contact["error"] = str(e)[:120]
                failed += 1
        campaigns = load_campaigns()
        campaigns[campaign_id]["contacts"] = contacts
        campaigns[campaign_id]["sent"] = sent
        campaigns[campaign_id]["failed"] = failed
        save_campaigns(campaigns)
        if i + BATCH_SIZE < len(contacts):
            time.sleep(BATCH_DELAY)
    campaigns = load_campaigns()
    campaigns[campaign_id]["status"] = "done"
    campaigns[campaign_id]["finishedAt"] = datetime.now().isoformat()
    campaigns[campaign_id]["sent"] = sent
    campaigns[campaign_id]["failed"] = failed
    save_campaigns(campaigns)


# ═══════════════════════════════════════════════
# ROUTES
# ═══════════════════════════════════════════════

@app.get("/health")
def health():
    return jsonify({"status": "ok", "supabase": USE_SUPABASE, "timestamp": datetime.now().isoformat()})


# ── Scraping ──────────────────────────────────

@app.post("/api/v1/scraping/start")
def start_scraping():
    try:
        data = StartScrapingRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    source_account = data.sourceAccount
    max_followers = data.maxFollowers
    reset_cursor_flag = data.resetCursor
    output_file = SCRAPER_DIR / f"leads_{source_account}.csv"

    print(f"[v1.0.7] START_SCRAPING: account={source_account}, max_followers={max_followers}, reset={reset_cursor_flag}", flush=True)

    if USE_SUPABASE:
        sb = get_sb()
        job_id = str(uuid.uuid4())
        insert_data = {
            "id": job_id, "source_account": source_account,
            "status": "pending", "leads_found": 0, "leads_new": 0,
            "max_followers": max_followers, "users_analyzed": 0,
            "hibernate": data.hibernate,
            "reset_cursor": reset_cursor_flag,
            "usernames": data.usernames,
        }
        print(f"[v1.0.7] INSERT DATA: {insert_data}", flush=True)
        sb.from_("scraper_jobs").insert(insert_data).execute()
    else:
        job_id = str(uuid.uuid4())[:8]
        jobs = load_jobs()
        jobs[job_id] = {"id": job_id, "sourceAccount": source_account, "status": "pending",
                        "maxFollowers": max_followers, "outputFile": str(output_file),
                        "createdAt": datetime.now().isoformat(), "errorMessage": None}
        save_jobs(jobs)

    # Encolar la tarea de forma secuencial thread-safe
    scraper_queue.put((job_id, source_account, max_followers, output_file, reset_cursor_flag, data.hibernate, data.usernames))
    
    # Asegurar que el hilo de la cola está corriendo
    with queue_lock:
        global is_queue_worker_running
        if not is_queue_worker_running:
            is_queue_worker_running = True
            threading.Thread(target=api_queue_worker, daemon=True).start()
    return jsonify({"jobId": job_id, "status": "pending"}), 202


@app.get("/api/v1/scraping/status/all")
def get_all_jobs():
    if USE_SUPABASE:
        sb = get_sb()
        resp = sb.from_("scraper_jobs").select("*").order("created_at", desc=True).execute()
        result = []
        for j in (resp.data or []):
            status = j["status"]
            if status == "done":
                status = "completed"
            elif status == "running":
                status = "processing"
            
            max_followers = j.get("max_followers")
            if max_followers is None:
                max_followers = 1000
            users_analyzed = j.get("users_analyzed") or 0

            # v1.0.7: Modo automático — no fabricar 10000
            if max_followers <= 0:
                if status == "completed":
                    display_max = users_analyzed if users_analyzed > 0 else 0
                    progress = 100
                else:
                    display_max = 0  # Frontend muestra spinner
                    progress = 0
            else:
                display_max = max_followers
                if status == "completed":
                    progress = 100
                else:
                    progress = min(99, int((users_analyzed / max(display_max, 1)) * 100))

            result.append({
                "id": j["id"], "target": j["source_account"], "status": status,
                "usersAnalyzed": users_analyzed,
                "maxFollowers": display_max, "usersFound": j.get("leads_found") or 0,
                "progress": progress,
                "date": (j.get("created_at") or "")[:10],
                "startedAt": j.get("started_at"),
                "errorMessage": j.get("error_message"),
            })
        return jsonify(result)

    # Legacy JSON
    jobs = load_jobs()
    result = []
    for job in jobs.values():
        leads_found = count_leads(Path(job.get("outputFile", "")))
        max_f = job.get("maxFollowers", 1000)
        if job["status"] == "completed":
            progress = 100
        elif job["status"] == "processing":
            progress = min(90, int((leads_found / max(max_f * 0.05, 1)) * 100))
        else:
            progress = 0
        result.append({"id": job["id"], "target": job["sourceAccount"], "status": job["status"],
                        "usersAnalyzed": leads_found * 8, "maxFollowers": max_f,
                        "usersFound": leads_found, "progress": progress,
                        "date": job["createdAt"][:10], "errorMessage": job.get("errorMessage")})
    result.sort(key=lambda x: x["date"], reverse=True)
    return jsonify(result)


@app.get("/api/v1/scraping/status/<job_id>")
def get_job_status(job_id):
    if USE_SUPABASE:
        sb = get_sb()
        resp = sb.from_("scraper_jobs").select("*").eq("id", job_id).execute()
        if not resp.data:
            return jsonify({"error": "Job not found"}), 404
        j = resp.data[0]
        status = j["status"]
        if status == "done":
            status = "completed"
        elif status == "running":
            status = "processing"
            
        max_followers = j.get("max_followers")
        if max_followers is None:
            max_followers = 1000
        users_analyzed = j.get("users_analyzed") or 0

        # v1.0.7: Modo automático — no fabricar 10000
        if max_followers <= 0:
            if status == "completed":
                display_max = users_analyzed if users_analyzed > 0 else 0
                progress = 100
            else:
                display_max = 0
                progress = 0
        else:
            display_max = max_followers
            if status == "completed":
                progress = 100
            else:
                progress = min(99, int((users_analyzed / max(display_max, 1)) * 100))

        return jsonify({
            "id": j["id"],
            "status": status,
            "leadsFound": j.get("leads_found", 0),
            "progress": progress,
            "errorMessage": j.get("error_message"),
            "maxFollowers": display_max,
            "usersAnalyzed": users_analyzed
        })
    jobs = load_jobs()
    job = jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    leads_found = count_leads(Path(job.get("outputFile", "")))
    return jsonify({"id": job["id"], "status": job["status"], "leadsFound": leads_found,
                     "progress": 100 if job["status"] == "completed" else (50 if job["status"] == "processing" else 0),
                     "errorMessage": job.get("errorMessage")})


# ── Cancel Job ──────────────────────────────

@app.post("/api/v1/scraping/cancel/<job_id>")
def cancel_job(job_id):
    if USE_SUPABASE:
        sb = get_sb()
        resp = sb.from_("scraper_jobs").select("status").eq("id", job_id).execute()
        if not resp.data:
            return jsonify({"error": "Job not found"}), 404
        current_status = resp.data[0].get("status")
        if current_status not in ("pending", "running"):
            return jsonify({"error": f"Cannot cancel job with status '{current_status}'"}), 400
        sb.from_("scraper_jobs").update({
            "status": "cancelled",
            "finished_at": datetime.now().isoformat(),
            "error_message": "Cancelado manualmente por el usuario."
        }).eq("id", job_id).execute()
        return jsonify({"ok": True, "jobId": job_id, "status": "cancelled"})
    return jsonify({"error": "Supabase not configured"}), 500


# ── AI Email Generation ───────────────────────

@app.post("/api/v1/emails/generate-ai")
def generate_ai_email():
    body = request.get_json(force=True) or {}
    prompt = body.get("prompt", "").strip()
    styles = body.get("styles", [])  # list of style tags
    context = body.get("context", "").strip()

    if not prompt:
        return jsonify({"error": "prompt es requerido"}), 400
    if not OPENROUTER_API_KEY:
        return jsonify({"error": "OPENROUTER_API_KEY no configurada en el servidor"}), 500

    style_desc = ", ".join(styles) if styles else "profesional"
    system_msg = (
        "Eres un experto en email marketing B2B para empresas de RRHH en Argentina. "
        "Tu tarea es generar únicamente el cuerpo de un email en formato HTML listo para enviar. "
        "El HTML debe estar bien estructurado, ser visualmente atractivo con estilos inline, "
        "incluir colores corporativos suaves y ser responsivo. "
        "MUY IMPORTANTE: ES OBLIGATORIO que incluyas siempre las siguientes variables en el texto para personalización automática: {{first_name}}, {{username}} y {{empresa}}. Úsalas de forma natural. "
        "NO incluyas explicaciones ni código markdown. DEVUELVE SOLO EL CONTENIDO HTML INTERNO. NO INCLUYAS las etiquetas <!DOCTYPE html>, <html>, <head> ni <body>."
    )
    user_msg = f"""Genera un email con las siguientes características:
- Estilo: {style_desc}
- Objetivo/tema: {prompt}
{('- Contexto adicional: ' + context) if context else ''}

REGLA ESTRICTA: El mensaje debe contener los textos exactos '{{{{first_name}}}}', '{{{{username}}}}' y '{{{{empresa}}}}'.
Devuelve SOLO el HTML del email, sin explicaciones."""

    try:
        import urllib.request
        import json as _json
        req_data = _json.dumps({
            "model": OPENROUTER_MODEL,
            "messages": [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg}
            ],
            "max_tokens": 2000,
            "temperature": 0.7
        }).encode()
        req = urllib.request.Request(
            "https://openrouter.ai/api/v1/chat/completions",
            data=req_data,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://one-crm-auraos.onrender.com",
                "X-Title": "ONE CRM Email Generator"
            },
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=60) as resp_ai:
            result = _json.loads(resp_ai.read().decode())
        html_content = result["choices"][0]["message"]["content"].strip()
        # Strip any markdown code fences if the model added them
        if html_content.startswith("```"):
            lines = html_content.split("\n")
            html_content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        return jsonify({"html": html_content, "model": OPENROUTER_MODEL})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ── Leads (with pagination) ──────────────────

@app.post("/api/v1/leads")
def create_leads():
    """Carga manual o importación masiva de leads."""
    body = request.get_json(force=True) or {}
    raw = body.get("leads", [])
    if not raw:
        return jsonify({"error": "No leads provided"}), 400

    inserted = skipped = 0
    errors = []

    if USE_SUPABASE:
        sb = get_sb()
        existing_emails: set[str] = set()
        try:
            resp = sb.from_("contacts").select("email").execute()
            existing_emails = {r["email"].lower() for r in (resp.data or []) if r.get("email")}
        except Exception:
            pass

        for item in raw:
            email = (item.get("email") or "").strip().lower()
            if not email or "@" not in email:
                skipped += 1
                continue
            if email in existing_emails:
                skipped += 1
                continue
            try:
                record = {
                    "id": str(uuid.uuid4()),
                    "name": (item.get("name") or item.get("full_name") or "").strip() or None,
                    "instagram_username": (item.get("instagram_username") or item.get("username") or "").strip() or None,
                    "email": email,
                    "phone": (item.get("phone") or "").strip() or None,
                    "company": (item.get("company") or "").strip() or None,
                    "source": (item.get("source") or item.get("sourceAccount") or "manual").strip(),
                    "lead_score": int(item.get("lead_score") or 0),
                    "notes": (item.get("notes") or "").strip() or None,
                    "created_at": datetime.now().isoformat(),
                }
                sb.from_("contacts").insert(record).execute()
                existing_emails.add(email)
                inserted += 1
            except Exception as e:
                errors.append(str(e)[:80])
    else:
        # Legacy CSV fallback
        output_path = SCRAPER_DIR / "leads_manual.csv"
        exists = output_path.exists()
        existing_emails: set[str] = set()
        if exists:
            with open(output_path, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    e = (row.get("email") or "").strip().lower()
                    if e:
                        existing_emails.add(e)
        with open(output_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["username","full_name","email","phone","website","bio","category","followers","following","is_verified","source_account","scraped_at"], extrasaction="ignore")
            if not exists:
                writer.writeheader()
            for item in raw:
                email = (item.get("email") or "").strip().lower()
                if not email or "@" not in email or email in existing_emails:
                    skipped += 1
                    continue
                writer.writerow({
                    "username": (item.get("name") or email.split("@")[0]).strip(),
                    "full_name": (item.get("name") or "").strip(),
                    "email": email,
                    "phone": (item.get("phone") or "").strip(),
                    "website": "",
                    "bio": "",
                    "category": (item.get("company") or "").strip(),
                    "followers": 0,
                    "following": 0,
                    "is_verified": False,
                    "source_account": (item.get("source") or "manual"),
                    "scraped_at": datetime.now().isoformat(),
                })
                existing_emails.add(email)
                inserted += 1

    return jsonify({"inserted": inserted, "skipped": skipped, "errors": errors[:5]}), 201


@app.get("/api/v1/leads")
def get_leads():
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 200))
    source_filter = request.args.get("sourceAccount", "")
    phone_only = request.args.get("phone") == "true"

    if USE_SUPABASE:
        sb = get_sb()
        query = sb.from_("contacts").select("*", count="exact")
        if source_filter:
            query = query.eq("source", source_filter)
        offset = (page - 1) * limit
        resp = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        leads = []
        for c in (resp.data or []):
            if phone_only and not c.get("phone"):
                continue
            leads.append({
                "id": c["id"],
                "username": c.get("instagram_username") or c.get("name", ""),
                "fullname": c.get("name", ""),
                "bio": "", "email": c.get("email", ""), "phone": c.get("phone", ""),
                "website": "", "category": c.get("source", ""),
                "followersCount": 0, "followingCount": 0,
                "sourceAccount": c.get("source", ""), "scrapedAt": c.get("created_at", ""),
                "qualityScore": c.get("lead_score", 0),
            })
        total = resp.count or len(leads)
        return jsonify({"data": leads, "total": total, "page": page, "limit": limit,
                         "totalPages": -(-total // limit) if total else 0})

    # Legacy CSV fallback
    seen = set()
    leads = []
    for csv_file in sorted(SCRAPER_DIR.glob("leads_*.csv"), key=lambda f: f.stat().st_mtime, reverse=True):
        try:
            with open(csv_file, encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    username = (row.get("username") or "").strip()
                    if not username or username in seen:
                        continue
                    seen.add(username)
                    if not row.get("email"):
                        continue
                    if source_filter and row.get("source_account") != source_filter:
                        continue
                    if phone_only and not row.get("phone"):
                        continue
                    email = (row.get("email") or "").strip()
                    phone = (row.get("phone") or "").strip()
                    website = (row.get("website") or "").strip()
                    followers = int(row.get("followers") or 0)
                    score = 0
                    if email: score += 40
                    if phone: score += 30
                    if website: score += 20
                    if followers > 1000: score += 10
                    leads.append({
                        "id": username, "username": username,
                        "fullname": row.get("full_name") or "", "bio": row.get("bio") or "",
                        "email": email, "phone": phone, "website": website,
                        "category": row.get("category") or "",
                        "followersCount": followers,
                        "followingCount": int(row.get("following") or 0),
                        "sourceAccount": row.get("source_account") or "",
                        "scrapedAt": row.get("scraped_at") or "",
                        "qualityScore": score,
                    })
        except Exception:
            continue

    total = len(leads)
    start = (page - 1) * limit
    paginated = leads[start:start + limit]
    return jsonify({"data": paginated, "total": total, "page": page, "limit": limit,
                     "totalPages": -(-total // limit) if total else 0})


@app.get("/api/v1/leads/sources")
def get_lead_sources():
    if USE_SUPABASE:
        sb = get_sb()
        try:
            resp = sb.from_("contacts").select("source").execute()
            sources = set()
            for r in (resp.data or []):
                src = r.get("source")
                if src:
                    for val in src.split(","):
                        val_clean = val.strip()
                        if val_clean:
                            sources.add(val_clean)
            return jsonify(sorted(list(sources)))
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    
    # Legacy CSV fallback
    sources = set()
    for csv_file in SCRAPER_DIR.glob("leads_*.csv"):
        name = csv_file.name.replace("leads_", "").replace(".csv", "").replace("_", ".")
        if name != "manual":
            sources.add(name)
    return jsonify(sorted(list(sources)))


@app.post("/api/v1/leads/delete")
def delete_leads():
    body = request.get_json(force=True) or {}
    ids = body.get("ids", [])
    if not ids:
        return jsonify({"error": "No ids provided"}), 400
    
    deleted = 0
    if USE_SUPABASE:
        sb = get_sb()
        try:
            resp = sb.from_("contacts").delete().in_("id", ids).execute()
            deleted = len(resp.data or [])
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"ok": True, "deleted": deleted})


# ── Dashboard stats ──────────────────────────

@app.get("/api/v1/dashboard/stats")
def dashboard_stats():
    if USE_SUPABASE:
        sb = get_sb()
        contacts = sb.from_("contacts").select("id", count="exact").execute()
        jobs = sb.from_("scraper_jobs").select("id, status").execute()
        job_list = jobs.data or []
        return jsonify({
            "totalLeads": contacts.count or 0,
            "totalJobs": len([j for j in job_list if j["status"] == "done"]),
            "activeJobs": len([j for j in job_list if j["status"] in ("pending", "running")]),
        })
    # Legacy
    leads_count = 0
    for csv_file in SCRAPER_DIR.glob("leads_*.csv"):
        leads_count += count_leads(csv_file)
    jobs = load_jobs()
    return jsonify({
        "totalLeads": leads_count,
        "totalJobs": len([j for j in jobs.values() if j["status"] == "completed"]),
        "activeJobs": len([j for j in jobs.values() if j["status"] in ("pending", "processing")]),
    })


# ── Instagram Session (REMOVED in v1.0.7 — session management descartado) ──


# ── Emails ───────────────────────────────────

@app.post("/api/v1/emails/send")
def send_single_email():
    """Send a one-off email (used from the Emails page)."""
    try:
        data = SendEmailRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422
    try:
        r = resend.Emails.send({"from": RESEND_FROM, "to": data.to, "subject": data.subject, "html": data.html})
        return jsonify({"id": r["id"], "status": "sent"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.get("/api/v1/email-accounts")
def get_email_accounts():
    """Return configured email sender accounts (currently just RESEND_FROM)."""
    return jsonify([
        {
            "id": "1",
            "name": "Cuenta Principal",
            "email": RESEND_FROM,
            "limit": "Ilimitado"
        }
    ])


# ── Campaigns ────────────────────────────────

@app.post("/api/v1/campaigns")
def create_campaign():
    try:
        data = CreateCampaignRequest(**(request.get_json(force=True) or {}))
    except ValidationError as e:
        return jsonify({"error": e.errors()}), 422

    seen = set()
    clean = []
    for c in data.contacts:
        email = (c.get("email") or "").strip().lower()
        if email and email not in seen:
            seen.add(email)
            clean.append({"email": email, "name": c.get("name", ""), "status": "pending"})
    if not clean:
        return jsonify({"error": "No valid email addresses provided"}), 400

    if USE_SUPABASE:
        sb = get_sb()
        campaign_id = str(uuid.uuid4())
        name = data.name or f"Campaña {datetime.now().strftime('%d/%m %H:%M')}"
        sb.from_("campaigns").insert({
            "id": campaign_id, "name": name, "subject": data.subject,
            "html": data.html, "total": len(clean), "sent": 0, "failed": 0, "status": "pending",
        }).execute()
        for c in clean:
            sb.from_("campaign_contacts").insert({
                "campaign_id": campaign_id, "email": c["email"], "name": c["name"], "status": "pending",
            }).execute()
        threading.Thread(target=run_campaign, args=(campaign_id,), daemon=True).start()
        return jsonify({"campaignId": campaign_id, "total": len(clean), "status": "pending"}), 202

    # Legacy JSON
    campaign_id = str(uuid.uuid4())[:8]
    campaigns = load_campaigns()
    campaigns[campaign_id] = {
        "id": campaign_id, "name": data.name or f"Campaña {datetime.now().strftime('%d/%m %H:%M')}",
        "subject": data.subject, "html": data.html, "contacts": clean,
        "total": len(clean), "sent": 0, "failed": 0, "status": "pending",
        "createdAt": datetime.now().isoformat(), "startedAt": None, "finishedAt": None,
    }
    save_campaigns(campaigns)
    threading.Thread(target=run_campaign, args=(campaign_id,), daemon=True).start()
    return jsonify({"campaignId": campaign_id, "total": len(clean), "status": "pending"}), 202


@app.get("/api/v1/campaigns")
def list_campaigns():
    if USE_SUPABASE:
        sb = get_sb()
        resp = sb.from_("campaigns").select("*").order("created_at", desc=True).execute()
        result = []
        for c in (resp.data or []):
            result.append({
                "id": c["id"], "name": c["name"], "subject": c["subject"], "html": c.get("html", ""),
                "total": c["total"], "sent": c["sent"], "failed": c["failed"],
                "status": c["status"], "createdAt": c["created_at"],
                "finishedAt": c.get("finished_at"),
            })
        return jsonify(result)
    campaigns = load_campaigns()
    result = []
    for c in campaigns.values():
        result.append({"id": c["id"], "name": c["name"], "subject": c["subject"], "html": c.get("html", ""),
                        "total": c["total"], "sent": c["sent"], "failed": c["failed"],
                        "status": c["status"], "createdAt": c["createdAt"],
                        "finishedAt": c.get("finishedAt")})
    result.sort(key=lambda x: x["createdAt"], reverse=True)
    return jsonify(result)


@app.get("/api/v1/campaigns/<campaign_id>")
def get_campaign(campaign_id):
    if USE_SUPABASE:
        sb = get_sb()
        resp = sb.from_("campaigns").select("*").eq("id", campaign_id).execute()
        if not resp.data:
            return jsonify({"error": "Campaign not found"}), 404
        c = resp.data[0]
        contacts_resp = sb.from_("campaign_contacts").select("*").eq("campaign_id", campaign_id).execute()
        c["contacts"] = contacts_resp.data or []
        return jsonify(c)
    campaigns = load_campaigns()
    c = campaigns.get(campaign_id)
    if not c:
        return jsonify({"error": "Campaign not found"}), 404
    return jsonify(campaigns[campaign_id])


@app.put("/api/v1/campaigns/<campaign_id>")
def update_campaign(campaign_id):
    data = request.get_json(force=True) or {}
    if USE_SUPABASE:
        sb = get_sb()
        update_data = {}
        if "name" in data: update_data["name"] = data["name"]
        if "subject" in data: update_data["subject"] = data["subject"]
        if "html" in data: update_data["html"] = data["html"]
        if not update_data: return jsonify({"status": "ok"}), 200
        resp = sb.from_("campaigns").update(update_data).eq("id", campaign_id).execute()
        if not resp.data: return jsonify({"error": "Campaign not found"}), 404
        return jsonify({"status": "updated"})

    campaigns = load_campaigns()
    if campaign_id not in campaigns:
        return jsonify({"error": "Campaign not found"}), 404
    c = campaigns[campaign_id]
    if "name" in data: c["name"] = data["name"]
    if "subject" in data: c["subject"] = data["subject"]
    if "html" in data: c["html"] = data["html"]
    save_campaigns(campaigns)
    return jsonify({"status": "updated"})


# ── Entry point ──────────────────────────────

if __name__ == "__main__":
    import io, sys
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if not resend.api_key:
        print("AVISO: RESEND_API_KEY no configurada. Los emails no se enviaran.")
    else:
        key = resend.api_key
        print(f"OK: Resend cargado - key: {key[:8]}...{key[-4:]}  |  from: {RESEND_FROM}")
    if not USE_SUPABASE:
        print("AVISO: Supabase no configurado. Usando almacenamiento JSON/CSV local.")
    else:
        print("OK: Supabase conectado.")
    print("API corriendo en http://localhost:5000")
    app.run(port=5000, debug=False)
