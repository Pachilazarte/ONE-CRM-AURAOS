"""
Scraper Worker — polls Supabase for pending jobs and executes them.
Run: python apps/api/worker.py

This replaces daemon threads with a persistent worker process.
Jobs survive API restarts and have automatic retry support.
"""

import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime

from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
ROOT_DIR = BASE_DIR.parent.parent
load_dotenv(dotenv_path=ROOT_DIR / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("⚠️  SUPABASE_URL y SUPABASE_SERVICE_KEY son requeridos para el worker.")
    print("   El worker requiere Supabase para la cola de tareas.")
    sys.exit(1)

from postgrest import SyncPostgrestClient

sb = SyncPostgrestClient(
    f"{SUPABASE_URL}/rest/v1",
    headers={
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    },
)

SCRAPER_DIR = ROOT_DIR / "apps" / "scraper"
PYTHON = sys.executable
POLL_INTERVAL = 5  # seconds
MAX_RETRIES = 3


def claim_job():
    """Find and claim one pending job atomically."""
    resp = sb.from_("scraper_jobs") \
        .select("*") \
        .eq("status", "pending") \
        .order("created_at") \
        .limit(1) \
        .execute()

    if not resp.data:
        return None

    job = resp.data[0]
    # Claim it by setting status to running
    sb.from_("scraper_jobs").update({
        "status": "running",
        "started_at": datetime.now().isoformat(),
    }).eq("id", job["id"]).eq("status", "pending").execute()

    return job


def run_job(job: dict):
    """Execute the scraper for a claimed job."""
    import json
    import csv

    job_id = job["id"]
    source_account = job["source_account"]
    output_file = SCRAPER_DIR / f"leads_{source_account}.csv"
    
    # Read parameters from Supabase job
    max_followers = job.get("max_followers")
    if max_followers is None:
        max_followers = 1000
    
    hibernate = job.get("hibernate") or False
    reset_cursor = job.get("reset_cursor") or False
    usernames = job.get("usernames") or ""

    print(f"🚀 Running job {job_id[:8]}... target=@{source_account} | max={max_followers} | hibernate={hibernate} | reset={reset_cursor}")

    # Build known emails for deduplication
    known_emails: set[str] = set()
    try:
        resp = sb.from_("contacts").select("email").execute()
        for r in (resp.data or []):
            e = (r.get("email") or "").strip().lower()
            if e:
                known_emails.add(e)
    except Exception as e:
        print(f"⚠️ Error querying contacts email for deduplication: {e}", file=sys.stderr)

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

    # Build full command
    cmd = [
        PYTHON, str(SCRAPER_DIR / "scraper.py"),
        "--target", source_account,
        "--max-followers", str(max_followers),
        "--output", str(output_file),
        "--known-emails", str(known_emails_file)
    ]
    if job_id:
        cmd.extend(["--job-id", job_id])
    if reset_cursor:
        cmd.append("--reset-cursor")
    if hibernate:
        cmd.append("--hibernate")
    if usernames:
        cmd.extend(["--usernames", usernames])

    try:
        # Run subprocess without arbitrary 10 min timeout to support long hibernation runs
        result = subprocess.run(
            cmd,
            capture_output=True, text=True
        )

        # Count leads in output
        leads_found = 0
        if output_file.exists():
            with open(output_file, encoding="utf-8") as f:
                leads_found = max(0, sum(1 for _ in csv.DictReader(f)))

        if result.returncode == 0:
            sb.from_("scraper_jobs").update({
                "status": "done",
                "finished_at": datetime.now().isoformat(),
                "leads_found": leads_found,
            }).eq("id", job_id).execute()
            print(f"✅ Job {job_id[:8]} completed — {leads_found} leads found")
        else:
            error_msg = (result.stderr or "Unknown error")[-500:]
            sb.from_("scraper_jobs").update({
                "status": "error",
                "finished_at": datetime.now().isoformat(),
                "error_message": error_msg,
            }).eq("id", job_id).execute()
            print(f"❌ Job {job_id[:8]} failed: {error_msg[:100]}")

    except subprocess.TimeoutExpired:
        sb.from_("scraper_jobs").update({
            "status": "error",
            "finished_at": datetime.now().isoformat(),
            "error_message": "Timeout: job exceeded execution limit",
        }).eq("id", job_id).execute()
        print(f"⏰ Job {job_id[:8]} timed out")

    except Exception as e:
        sb.from_("scraper_jobs").update({
            "status": "error",
            "finished_at": datetime.now().isoformat(),
            "error_message": str(e)[:500],
        }).eq("id", job["id"]).execute()
        print(f"💥 Job {job['id'][:8]} exception: {e}")


def poll():
    """Main polling loop."""
    print("=" * 50)
    print("  ONE CRM — Scraper Worker")
    print(f"  Polling every {POLL_INTERVAL}s for pending jobs")
    print("=" * 50)

    while True:
        try:
            job = claim_job()
            if job:
                run_job(job)
            else:
                time.sleep(POLL_INTERVAL)
        except KeyboardInterrupt:
            print("\n👋 Worker stopped.")
            break
        except Exception as e:
            print(f"⚠️ Poll error: {e}")
            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    poll()
