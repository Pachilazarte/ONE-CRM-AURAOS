"""
Instagram Lead Scraper — powered by instaloader
Extracts contact data (email, phone, website) from business/creator accounts
that follow a target Instagram profile.

Usage:
    python scraper.py --target positivo.rrhh --output leads.csv
    python scraper.py --target nike --max-followers 500 --output leads.csv
"""

import instaloader
import requests
import csv
import argparse
import logging
import json
import time
import random
import sys
import os
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

from residential_proxy import apply_to_session


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

ACCOUNTS_FILE = Path(__file__).parent / "accounts.json"

FIELDS = [
    "username", "full_name", "email", "phone", "website",
    "bio", "category", "followers", "following", "is_verified",
    "source_account", "scraped_at",
]


# ─────────────────────────────────────────────
# SUPABASE INTEGRATION
# ─────────────────────────────────────────────

from dotenv import load_dotenv
load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / '.env')

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

_sb_client = None

def get_supabase_client():
    global _sb_client
    if _sb_client is None and SUPABASE_URL and SUPABASE_SERVICE_KEY:
        try:
            from postgrest import SyncPostgrestClient
            _sb_client = SyncPostgrestClient(
                f"{SUPABASE_URL}/rest/v1",
                headers={
                    "apikey": SUPABASE_SERVICE_KEY,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                },
            )
        except Exception as e:
            log.warning(f"No se pudo inicializar el cliente de Supabase: {e}")
    return _sb_client

def load_db_cursor(job_id: str) -> dict | None:
    client = get_supabase_client()
    if not client or not job_id:
        return None
    try:
        resp = client.from_("scraper_jobs").select("cursor").eq("id", job_id).execute()
        if resp.data and resp.data[0].get("cursor"):
            cursor_data = json.loads(resp.data[0]["cursor"])
            return cursor_data
    except Exception as e:
        log.warning(f"Error cargando cursor desde Supabase: {e}")
    return None

def save_db_cursor(job_id: str, cursor_data: dict):
    client = get_supabase_client()
    if not client or not job_id:
        return
    try:
        client.from_("scraper_jobs").update({"cursor": json.dumps(cursor_data)}).eq("id", job_id).execute()
        log.info("Cursor guardado en Supabase con éxito.")
    except Exception as e:
        log.warning(f"Error guardando cursor en Supabase: {e}")

def update_db_stats(job_id: str, leads_found: int, users_analyzed: int):
    client = get_supabase_client()
    if not client or not job_id:
        return
    try:
        client.from_("scraper_jobs").update({
            "leads_found": leads_found,
            "users_analyzed": users_analyzed
        }).eq("id", job_id).execute()
        log.info(f"Estadísticas actualizadas en Supabase: {leads_found} leads, {users_analyzed} analizados.")
    except Exception as e:
        log.warning(f"Error actualizando estadísticas en Supabase: {e}")


def save_lead_to_supabase(lead: dict):
    client = get_supabase_client()
    if not client:
        return
    try:
        email = lead["email"].strip().lower()
        # Deduplication check in Supabase contacts
        resp = client.from_("contacts").select("id, source").eq("email", email).execute()
        
        # Calculate quality score (lead score)
        score = 0
        if lead.get("email"): score += 40
        if lead.get("phone"): score += 30
        if lead.get("website"): score += 20
        if lead.get("followers", 0) > 1000: score += 10
        
        if resp.data:
            # Contact already exists! Update source segment to include the new one if new
            existing_contact = resp.data[0]
            existing_source = existing_contact.get("source") or ""
            new_source = lead["source_account"]
            
            if new_source not in existing_source:
                combined_source = f"{existing_source}, {new_source}".strip(", ")
                client.from_("contacts").update({
                    "source": combined_source,
                    "updated_at": datetime.now().isoformat()
                }).eq("id", existing_contact["id"]).execute()
                log.info(f"Deduplicación Supabase: Segmento de lead {email} actualizado a: {combined_source}")
            else:
                log.info(f"Deduplicación Supabase: Lead {email} ya pertenece al segmento {new_source}, omitiendo.")
        else:
            # Insert new contact
            import uuid
            record = {
                "id": str(uuid.uuid4()),
                "name": lead["full_name"] or lead["username"],
                "instagram_username": lead["username"],
                "email": email,
                "phone": lead["phone"] or None,
                "company": lead["category"] or None,
                "source": lead["source_account"],
                "lead_score": score,
                "notes": f"Scraped from Instagram followers of @{lead['source_account']}",
                "created_at": datetime.now().isoformat(),
                "updated_at": datetime.now().isoformat()
            }
            client.from_("contacts").insert(record).execute()
            log.info(f"Lead @{lead['username']} guardado exitosamente en contacts de Supabase.")
    except Exception as e:
        log.warning(f"Error guardando lead en Supabase contacts: {e}")


# ─────────────────────────────────────────────
# SESSION SETUP
# ─────────────────────────────────────────────

def build_loader():
    L = instaloader.Instaloader(
        quiet=True,
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        max_connection_attempts=3,
        request_timeout=15,
    )
    apply_to_session(L.context._session)

    # v1.0.7: Auto-generar accounts.json desde variable de entorno si no existe (Render)
    if not ACCOUNTS_FILE.exists():
        env_accounts = os.environ.get("IG_ACCOUNTS_JSON", "").strip()
        if env_accounts:
            try:
                parsed = json.loads(env_accounts)
                ACCOUNTS_FILE.parent.mkdir(parents=True, exist_ok=True)
                with open(ACCOUNTS_FILE, "w", encoding="utf-8") as f:
                    json.dump(parsed, f, indent=2, ensure_ascii=False)
                log.info("accounts.json generado desde variable de entorno IG_ACCOUNTS_JSON.")
            except Exception as e:
                log.error(f"Error parseando IG_ACCOUNTS_JSON: {e}")

    accounts = []
    if not ACCOUNTS_FILE.exists():
        log.warning("No accounts.json found. Running without authentication (very limited).")
        return L, [], 0

    with open(ACCOUNTS_FILE, encoding="utf-8") as f:
        accounts = json.load(f)

    active = [a for a in accounts if a.get("status") not in ("banned", "expired")]
    if not active:
        sys.stderr.write("Error crítico: No hay cuentas activas o válidas en accounts.json (todas están 'banned' o 'expired'). Por favor actualiza la sesión de Instagram.\n")
        sys.exit(1)

    return _apply_account(L, active, 0, accounts)



def _apply_account(L, active, idx, accounts):
    """Inject cookies for active[idx] into instaloader session."""
    account = active[idx % len(active)]
    
    # Soporte para el nuevo formato "cookies" o fallback al formato antiguo
    cookies_dict = account.get("cookies")
    if not cookies_dict:
        cookies_dict = {
            "sessionid": unquote(account.get("session_id", "")),
            "ds_user_id": str(account.get("ds_user_id", "")),
            "csrftoken": account.get("csrftoken", "")
        }
    else:
        # Si viene del JSON, el sessionid puede venir url-encoded, así que lo descodificamos
        if "sessionid" in cookies_dict:
            cookies_dict["sessionid"] = unquote(cookies_dict["sessionid"])

    session_id = cookies_dict.get("sessionid", "")
    csrftoken = cookies_dict.get("csrftoken", "")

    if session_id:
        for k, v in cookies_dict.items():
            if v:
                L.context._session.cookies.set(k, v, domain=".instagram.com")

        L.context._session.headers.update({
            "X-CSRFToken": csrftoken,
            "X-IG-App-ID": "936619743392459",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Referer": "https://www.instagram.com/",
            "X-Requested-With": "XMLHttpRequest",
            "X-IG-WWW-Claim": "0",
        })

        # Warm-up: obtener X-IG-WWW-Claim real desde el home
        try:
            warm = L.context._session.get("https://www.instagram.com/", timeout=10)
            claim = warm.headers.get("X-IG-Set-IG-WWW-Claim") or warm.headers.get("x-ig-set-ig-www-claim")
            if claim:
                L.context._session.headers["X-IG-WWW-Claim"] = claim
                log.info(f"X-IG-WWW-Claim capturado: {claim[:30]}...")
        except Exception:
            pass

        L.context.username = account.get("username", "user")
        log.info(f"Session loaded for account: {account.get('username')}")
        # Asociar el nombre de la cuenta burner a la sesión para IP-binding
        L.context._session._burner_username = account.get("username")
        apply_to_session(L.context._session, session_name=account.get("username"))
    else:
        log.warning("sessionid is empty in accounts.json")

    return L, accounts, idx % len(active)


# ─────────────────────────────────────────────
# MOBILE API HELPERS  (reemplaza el GraphQL deprecado de instaloader)
# ─────────────────────────────────────────────

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
]

_ACCEPT_LANGS = [
    "es-AR,es;q=0.9,en;q=0.8",
    "es-ES,es;q=0.9,en;q=0.8",
    "en-US,en;q=0.9",
    "pt-BR,pt;q=0.9,en;q=0.8",
    "es-MX,es;q=0.9,en;q=0.8",
]

def random_headers() -> dict:
    return {
        "User-Agent": random.choice(_USER_AGENTS),
        "X-IG-App-ID": "936619743392459",
        "Accept": "*/*",
        "Accept-Language": random.choice(_ACCEPT_LANGS),
        "Referer": "https://www.instagram.com/",
        "X-Requested-With": "XMLHttpRequest",
    }

from curl_cffi import requests as curl_requests

def merge_headers(ig_session, extra: dict = None) -> dict:
    """Mezcla los headers de auth de la sesión con UA/Accept-Language aleatorio."""
    # En instaloader ig_session.headers puede ser de tipo requests.structures.CaseInsensitiveDict
    h = dict(ig_session.headers) if hasattr(ig_session, "headers") else {}
    h["User-Agent"] = random.choice(_USER_AGENTS)
    h["Accept-Language"] = random.choice(_ACCEPT_LANGS)
    if extra:
        h.update(extra)
    return h

def request_with_retry(ig_session: requests.Session, method: str, url: str, max_attempts: int = 4, **kwargs) -> requests.Response:
    """
    Executes an HTTP request with exponential backoff on HTTP 429 or connection errors,
    using curl_cffi to bypass JA3/TLS fingerprinting.
    """
    attempt = 0
    headers = merge_headers(ig_session, kwargs.get("headers"))
    
    # Extraer parámetros de requests para adaptarlos a curl_cffi si hiciera falta
    params = kwargs.get("params")
    timeout = kwargs.get("timeout", 15)
    
    # Construir sesión de curl_cffi que emula a Chrome
    session = curl_requests.Session(impersonate="chrome120")
    apply_to_session(session, session_name=getattr(ig_session, "_burner_username", None))
    
    # Inyectar cookies de la sesión de instaloader (requests.Session) a la sesión de curl_cffi
    if hasattr(ig_session, "cookies"):
        for cookie in ig_session.cookies:
            session.cookies.set(cookie.name, cookie.value, domain=cookie.domain or ".instagram.com")

    while attempt < max_attempts:
        try:
            # Mezclar cabeceras actualizadas
            session.headers.update(headers)
            
            # Registrar el tipo de proxy que se está usando
            r = session.request(method, url, params=params, timeout=timeout)
            
            if r.status_code == 200:
                # Retornamos el objeto curl_cffi.requests.Response adaptado a requests.Response (tiene interfaz idéntica)
                return r
            
            if r.status_code == 429:
                attempt += 1
                wait_time = 5 * (2 ** attempt) + random.uniform(1, 3)
                log.warning(f"HTTP 429 en {url} (con curl_cffi). Reintento {attempt}/{max_attempts} en {wait_time:.1f}s...")
                time.sleep(wait_time)
                # Rotar proxy recreando la sesión o re-aplicando proxies
                apply_to_session(session)
                continue
                
            if r.status_code in (401, 403):
                log.error(f"Error de auth HTTP {r.status_code} en {url} (con curl_cffi)")
                return r
                
            log.warning(f"HTTP {r.status_code} en {url}: {r.text[:150]}")
            return r
            
        except Exception as e:
            attempt += 1
            wait_time = 5 * (2 ** attempt) + random.uniform(1, 3)
            log.warning(f"Error con curl_cffi en {url}: {e}. Reintento {attempt}/{max_attempts} en {wait_time:.1f}s...")
            time.sleep(wait_time)
            apply_to_session(session)
            
    raise Exception(f"Fallo persistente tras {max_attempts} intentos en {url} usando curl_cffi")

def check_session_health(ig_session: requests.Session, username: str, accounts: list, current_idx: int) -> bool:
    """
    Checks if the active session is valid by hitting a lightweight endpoint.
    If it's expired (401/403 or redirects to login), updates accounts.json and returns False.
    """
    log.info(f"Health Check: Validando sesión activa de @{username}...")
    try:
        url = "https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram"
        # We don't use infinite retry here, max 2 attempts to fail fast if expired
        r = request_with_retry(ig_session, "GET", url, max_attempts=2, timeout=10)
        
        if r.status_code == 200:
            log.info(f"Health Check: Sesión de @{username} es VÁLIDA.")
            return True
            
        if r.status_code in (401, 403):
            log.error(f"Health Check: Sesión expirada para @{username} (HTTP {r.status_code}).")
            _mark_account_expired(username, accounts)
            return False
            
        # Check for redirects or page content suggesting login
        if r.history:
            for hist in r.history:
                if hist.status_code in (301, 302) and "login" in hist.headers.get("Location", ""):
                    log.error(f"Health Check: Sesión redirigida al login (expirada) para @{username}.")
                    _mark_account_expired(username, accounts)
                    return False
                    
        return True
    except Exception as e:
        log.warning(f"Health Check: Error al validar sesión ({e}). Continuando con precaución...")
        return True

def _mark_account_expired(username: str, accounts: list):
    for a in accounts:
        if a.get("username") == username:
            a["status"] = "expired"
            log.warning(f"Cuenta @{username} marcada como 'expired' en accounts.json.")
    with open(ACCOUNTS_FILE, "w", encoding="utf-8") as f:
        json.dump(accounts, f, indent=2, ensure_ascii=False)

def get_target_user_id(ig_session: requests.Session, username: str):
    """Resuelve el user_id de un username de forma inteligente y ligera."""
    import re as _re

    # ── Intento 1: Parsear el meta-tag al:ios:url del HTML público (Recomendado por Mailfind)
    # Extremadamente ligero, no pasa por endpoints internos de la API y casi no tiene rate limits.
    try:
        url = f"https://www.instagram.com/{username}/"
        r = request_with_retry(
            ig_session, "GET", url, 
            headers={"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"},
            timeout=15,
            max_attempts=2 # Fallar rápido para pasar al siguiente intento
        )
        if r.status_code == 200:
            text = r.text
            # Buscar meta property="al:ios:url" content="instagram://user?username=...&id=USER_ID"
            match = _re.search(r'instagram://user\?(?:username=[^&]*&)?id=(\d+)', text)
            if match:
                uid = match.group(1)
                log.info(f"Éxito: ID {uid} de @{username} extraído del meta-tag iOS en HTML.")
                return uid, 0
            
            # Buscar también en el JSON embebido clásico en HTML si falla el meta-tag
            slug = username.replace(".", "").replace("_", "").lower()
            for m in _re.finditer(r'"id"\s*:\s*"(\d{7,})"', text):
                uid = m.group(1)
                pos = text.find(uid)
                nearby = text[max(0, pos - 800):pos + 800].lower()
                if slug in nearby or username.split(".")[0].lower() in nearby:
                    log.info(f"Éxito: ID {uid} de @{username} extraído del JSON embebido en HTML.")
                    return uid, 0
    except Exception as e:
        log.warning(f"Extracción desde HTML de perfil falló: {e}")

    # ── Intento 2: Endpoint de Búsqueda Pública de autocompletado (Ligero y permisivo)
    try:
        url = f"https://www.instagram.com/web/search/topsearch/?context=blended&query={username}"
        r = request_with_retry(ig_session, "GET", url, timeout=12, max_attempts=2)
        if r.status_code == 200:
            data = r.json()
            for user_entry in data.get("users", []):
                u = user_entry.get("user", {})
                if u.get("username") == username:
                    uid = u.get("pk") or u.get("id")
                    if uid:
                        log.info(f"Éxito: ID {uid} de @{username} extraído de topsearch.")
                        return str(uid), u.get("follower_count", 0)
    except Exception as e:
        log.warning(f"Búsqueda en topsearch falló: {e}")

    # ── Intento 3: web_profile_info clásico (Fallback final hiper-vigilado)
    try:
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
        r = request_with_retry(ig_session, "GET", url, timeout=15, max_attempts=3)
        if r.status_code == 200:
            data = r.json().get("data", {}).get("user", {})
            uid = data.get("id")
            if uid:
                log.info(f"Éxito: ID {uid} de @{username} extraído de web_profile_info.")
                return uid, data.get("edge_followed_by", {}).get("count", 0)
    except Exception as e:
        log.warning(f"web_profile_info final de fallback falló: {e}")

    return None, 0

def get_followers_page(ig_session: requests.Session, user_id: str, max_id: str = None):
    """Página de seguidores via API web. Devuelve (users, next_max_id)."""
    params = {"count": 50}
    if max_id:
        params["max_id"] = max_id
    url = f"https://www.instagram.com/api/v1/friendships/{user_id}/followers/"
    try:
        r = request_with_retry(ig_session, "GET", url, params=params, timeout=15)
        if r.status_code == 200:
            data = r.json()
            return data.get("users", []), data.get("next_max_id")
    except Exception as e:
        log.warning(f"Error obteniendo seguidores: {e}")
    return [], None

def get_user_info_anonymous(username: str) -> dict | None:
    """
    Intenta obtener información pública y de contacto de un perfil de forma anónima (sin sesión).
    Utiliza curl_cffi con proxies residenciales simulando a Chrome.
    """
    url = f"https://www.instagram.com/{username}/?__a=1&__d=dis"
    try:
        # Usar curl_cffi para emular a Chrome 120
        session = curl_requests.Session(impersonate="chrome120")
        apply_to_session(session)
        session.headers.update({
            "User-Agent": random.choice(_USER_AGENTS),
            "Accept-Language": random.choice(_ACCEPT_LANGS),
            "X-IG-App-ID": "936619743392459",
            "Referer": "https://www.instagram.com/",
            "X-Requested-With": "XMLHttpRequest",
        })
        
        log.info(f"Intento de extracción anónima para @{username}...")
        r = session.get(url, timeout=12)
        
        if r.status_code == 200:
            data = r.json()
            user_data = data.get("graphql", {}).get("user") or data.get("data", {}).get("user")
            if user_data:
                # Si encontramos email o teléfono de forma anónima, triunfamos
                email = user_data.get("public_email") or user_data.get("business_email")
                if email or user_data.get("contact_phone_number") or user_data.get("business_phone_number"):
                    log.info(f"¡Éxito! Datos de contacto de @{username} extraídos de forma ANÓNIMA.")
                    # Normalizar campos del JSON público para adaptarlos a la salida estándar
                    user_data["public_email"] = email
                    user_data["contact_phone_number"] = user_data.get("contact_phone_number") or user_data.get("business_phone_number")
                    user_data["follower_count"] = user_data.get("edge_followed_by", {}).get("count") or user_data.get("followers_count", 0)
                    user_data["following_count"] = user_data.get("edge_follow", {}).get("count") or user_data.get("following_count", 0)
                    user_data["category_name"] = user_data.get("category_name") or user_data.get("business_category_name")
                    return user_data
        
        elif r.status_code == 429:
            log.warning(f"Rate limited (429) en consulta anónima para @{username}.")
        else:
            log.warning(f"Consulta anónima devuelta código {r.status_code} para @{username}.")
            
    except Exception as e:
        log.warning(f"Fallo en extracción anónima de @{username}: {e}")
    return None

def get_user_full_info(ig_session: requests.Session, user_id, accounts: list = None, current_idx: int = 0, username: str = "") -> dict:
    """Info completa de un usuario: email, teléfono, bio, website, is_business."""
    
    # ── PASO 1: EL TRUCO SUPREMO DE MAILFIND (Extracción Anónima) ──
    # Si tenemos el username, intentamos resolver de forma anónima sin cookies primero
    if username:
        anon_data = get_user_info_anonymous(username)
        if anon_data:
            return anon_data

    # ── PASO 2: FALLBACK AL ENDPOINT PESADO (Con Cuentas Burner Logueadas) ──
    url = f"https://www.instagram.com/api/v1/users/{user_id}/info/"
    try:
        r = request_with_retry(ig_session, "GET", url, timeout=15)
        if r.status_code in (401, 429):
            log.warning(f"Rate limited o baneado en info (HTTP {r.status_code}).")
            if accounts:
                active = [a for a in accounts if a.get("status") not in ("banned", "expired")]
                if current_idx < len(active):
                    # Marcar cuenta activa como banned
                    banned_user = active[current_idx]["username"]
                    for a in accounts:
                        if a.get("username") == banned_user:
                            a["status"] = "banned"
                            log.warning(f"Cuenta @{banned_user} marcada como 'banned' en accounts.json.")
                    with open(ACCOUNTS_FILE, "w", encoding="utf-8") as f:
                        json.dump(accounts, f, indent=2, ensure_ascii=False)
            return {"_rate_limited": True}
        if r.status_code == 200:
            return r.json().get("user", {})
    except Exception as e:
        log.warning(f"Error al obtener info completa de {user_id}: {e}")
    return {}



# ─────────────────────────────────────────────
# LEAD EXTRACTION
# ─────────────────────────────────────────────

def is_business(profile: instaloader.Profile) -> bool:
    return profile.is_business_account or getattr(profile, "is_professional_account", False)

def extract_lead(profile: instaloader.Profile, contact: dict, source: str) -> dict | None:
    email = contact.get("email", "").strip()
    phone = contact.get("phone", "")
    website = profile.external_url or ""
    bio = (profile.biography or "").replace("\n", " ").strip()

    if not email:  # require email — leads without email are not useful
        return None

    return {
        "username": profile.username,
        "full_name": profile.full_name,
        "email": email,
        "phone": phone,
        "website": website.strip(),
        "bio": bio,
        "category": contact.get("category") or getattr(profile, "business_category_name", "") or "",
        "followers": profile.followers,
        "following": profile.followees,
        "is_verified": profile.is_verified,
        "source_account": source,
        "scraped_at": datetime.now().isoformat(),
    }


# ─────────────────────────────────────────────
# MAIN FLOW
# ─────────────────────────────────────────────

def human_delay(checked: int, hibernate: bool = False):
    """
    - Entre perfiles: espera aleatoria de 1.5 a 4.0 segundos (30 a 60 segundos si hiberna)
    - Cada 10 perfiles: pausa intermedia de 5 a 10 minutos (si hiberna)
    - Cada 50 perfiles: pausa larga de 10 a 20 segundos (20 a 30 minutos si hiberna)
    """
    if hibernate:
        if checked > 0 and checked % 50 == 0:
            pause = random.uniform(1200, 1800) # 20-30 mins
            log.info(f"[Hibernación] Pausa ultra larga ({pause/60:.1f} minutos) para enfriar sesión...")
            time.sleep(pause)
        elif checked > 0 and checked % 10 == 0:
            pause = random.uniform(300, 600) # 5-10 mins
            log.info(f"[Hibernación] Pausa intermedia ({pause/60:.1f} minutos) para disipar sospechas...")
            time.sleep(pause)
        else:
            delay = random.uniform(30, 60) # 30-60 secs
            log.info(f"[Hibernación] Esperando {delay:.1f} segundos entre perfiles...")
            time.sleep(delay)
    else:
        if checked > 0 and checked % 50 == 0:
            pause = random.uniform(10, 20)
            log.info(f"Pausa larga ({pause:.1f}s) para evitar detección...")
            time.sleep(pause)
        else:
            time.sleep(random.uniform(1.5, 4.0))

def cursor_path(target: str) -> Path:
    return Path(__file__).parent / f"cursor_{target}.json"

def load_cursor(target: str) -> str | None:
    p = cursor_path(target)
    if not p.exists():
        return None
    try:
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
            return data.get("last_username")
    except Exception:
        return None

def save_cursor(target: str, last_username: str):
    p = cursor_path(target)
    with open(p, "w", encoding="utf-8") as f:
        json.dump({
            "last_username": last_username,
            "saved_at": datetime.now().isoformat(),
            "target": target,
        }, f, indent=2)

def reset_cursor(target: str):
    p = cursor_path(target)
    if p.exists():
        p.unlink()
        log.info(f"Cursor borrado para @{target}.")

def run(target: str, output: str, max_followers: int, known_emails_file: str = "", reset: bool = False, job_id: str = "", hibernate: bool = False, usernames: str = ""):
    log.info(f"Starting scrape of @{target} | max followers: {max_followers}")

    if reset:
        reset_cursor(target)
        if job_id:
            try:
                client = get_supabase_client()
                if client:
                    client.from_("scraper_jobs").update({"cursor": None}).eq("id", job_id).execute()
                    log.info("Cursor en Supabase reseteado.")
            except Exception as e:
                log.warning(f"No se pudo resetear el cursor en Supabase: {e}")

    # Leer cursor desde Supabase o local
    cursor_data = None
    if job_id:
        cursor_data = load_db_cursor(job_id)

    if cursor_data:
        log.info(f"Cursor recuperado desde Supabase: {cursor_data}")
        last_username = cursor_data.get("last_username")
        cursor_max_id = cursor_data.get("max_id")
    else:
        # Fallback al cursor local anterior
        last_username = load_cursor(target)
        cursor_max_id = None
        if last_username:
            log.info(f"Cursor local: arrancando desde después de @{last_username}")
            # Cargar también max_id de archivo local si existe
            cp = cursor_path(target)
            if cp.exists():
                try:
                    with open(cp, encoding="utf-8") as f:
                        cursor_max_id = json.load(f).get("max_id")
                except Exception:
                    pass
        else:
            log.info("Sin cursor. Empezando desde el primer seguidor.")

    # Cargar usernames ya procesados (evita reanalizar en tandas futuras)
    known_usernames_file_path = Path(__file__).parent / f"known_usernames_{target}.json"
    known_usernames: set[str] = set()
    if known_usernames_file_path.exists():
        try:
            with open(known_usernames_file_path, encoding="utf-8") as f:
                known_usernames = {u.strip().lower() for u in json.load(f) if u}
            log.info(f"Cargados {len(known_usernames)} usernames previamente analizados para omitir.")
        except Exception:
            pass

    # Si tenemos cursor_max_id, ya estamos paginando directamente en el cursor correcto, no hace falta saltear usernames
    cursor_reached = (last_username is None or cursor_max_id is not None)

    # Load known emails to skip duplicates across runs
    known_emails: set[str] = set()
    if known_emails_file and Path(known_emails_file).exists():
        with open(known_emails_file, encoding="utf-8") as f:
            known_emails = {e.lower() for e in json.load(f) if e}
        log.info(f"Loaded {len(known_emails)} known emails to skip.")

    L, accounts, account_idx = build_loader()
    ig_session = L.context._session

    # Validación previa (health check) de la sesión cargada
    if accounts:
        active = [a for a in accounts if a.get("status") not in ("banned", "expired")]
        if active and account_idx < len(active):
            active_username = active[account_idx]["username"]
            if not check_session_health(ig_session, active_username, accounts, account_idx):
                sys.stderr.write(f"Error crítico: La sesión para @{active_username} ha expirado o es inválida (health check falló). Por favor, actualice la sesión de Instagram.\n")
                sys.exit(1)

    # Obtener user_id del target via mobile API
    target_user_id, followers_count = get_target_user_id(ig_session, target)
    if not target_user_id:
        sys.stderr.write(f"Error crítico: No se pudo obtener el perfil @{target}. Verificá que el nombre de usuario sea correcto, que la sesión sea válida y que la IP/Proxy no estén bloqueadas.\n")
        sys.exit(1)

    # Vaciado Total (v1.0.7: sin límite artificial de 10000)
    if max_followers <= 0:
        if followers_count > 0:
            log.info(f"Vaciado Total activado: Escaneando los {followers_count} seguidores de @{target}.")
        else:
            log.info(f"Vaciado Total activado: El conteo de seguidores es desconocido. Escaneando hasta que no haya más.")
        # Dejamos max_followers en -1 para que el loop no corte
        # NO actualizamos max_followers en la DB todavía—se actualizará al final con el total real

    log.info(f"@{target} (id={target_user_id}) tiene {followers_count} seguidores. Escaneando hasta {max_followers}...")

    output_path = Path(output)
    exists = output_path.exists()
    csv_file = open(output_path, "a", newline="", encoding="utf-8")
    writer = csv.DictWriter(csv_file, fieldnames=FIELDS, extrasaction="ignore")
    if not exists:
        writer.writeheader()

    leads_found = 0
    checked = 0

    usernames_list = [u.strip().lstrip("@") for u in usernames.split(",") if u.strip()] if usernames else []

    try:
        if usernames_list:
            log.info(f"Modo Barrido Manual: Iniciando escaneo de {len(usernames_list)} perfiles directamente.")
            # Sobrescribir max_followers del trabajo en Supabase si corresponde
            max_followers = len(usernames_list)
            if job_id:
                try:
                    client = get_supabase_client()
                    if client:
                        client.from_("scraper_jobs").update({"max_followers": max_followers}).eq("id", job_id).execute()
                except Exception:
                    pass

            for username in usernames_list:
                if checked >= max_followers:
                    break
                
                checked += 1
                username_lower = username.lower()
                if username_lower in known_usernames:
                    if job_id:
                        update_db_stats(job_id, leads_found, checked)
                    continue

                try:
                    uid, _ = get_target_user_id(ig_session, username)
                    if not uid:
                        log.warning(f"No se pudo resolver ID para @{username}, saltando...")
                        continue

                    full_info = get_user_full_info(ig_session, uid, accounts, account_idx, username=username)

                    max_rotations = len(accounts) if accounts else 1
                    rotation_attempt = 0
                    while full_info.get("_rate_limited") and rotation_attempt < max_rotations:
                        active = [a for a in accounts if a.get("status") not in ("banned", "expired")]
                        if not active:
                            sys.stderr.write("Error crítico: Cuentas burner bloqueadas.\n")
                            sys.exit(1)
                        account_idx = (account_idx + 1) % len(active)
                        L, accounts, account_idx = build_loader()
                        ig_session = L.context._session
                        log.info(f"Rotando a cuenta burner índice {account_idx} (intento {rotation_attempt+1})...")
                        full_info = get_user_full_info(ig_session, uid, accounts, account_idx, username=username)
                        rotation_attempt += 1

                    if full_info.get("_rate_limited"):
                        log.warning(f"No se pudo obtener info de @{username} tras rotar todas las cuentas burner. Continuando...")
                        continue

                    if not (full_info.get("is_business") or full_info.get("is_professional_account")):
                        known_usernames.add(username_lower)
                        if job_id:
                            update_db_stats(job_id, leads_found, checked)
                        if checked % 10 == 0:
                            with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                json.dump(list(known_usernames), f)
                        continue

                    email = (full_info.get("public_email") or "").strip()
                    if not email:
                        known_usernames.add(username_lower)
                        if job_id:
                            update_db_stats(job_id, leads_found, checked)
                        if checked % 10 == 0:
                            with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                json.dump(list(known_usernames), f)
                        continue

                    email_key = email.lower()
                    if email_key in known_emails:
                        known_usernames.add(username_lower)
                        if job_id:
                            update_db_stats(job_id, leads_found, checked)
                        if checked % 10 == 0:
                            with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                json.dump(list(known_usernames), f)
                        continue

                    lead = {
                        "username": username,
                        "full_name": (full_info.get("full_name") or "").strip(),
                        "email": email,
                        "phone": str(full_info.get("contact_phone_number") or "").strip(),
                        "website": (full_info.get("external_url") or "").strip(),
                        "bio": (full_info.get("biography") or "").replace("\n", " ").strip(),
                        "category": (full_info.get("category") or full_info.get("category_name") or "").strip(),
                        "followers": full_info.get("follower_count", 0),
                        "following": full_info.get("following_count", 0),
                        "is_verified": full_info.get("is_verified", False),
                        "source_account": target,
                        "scraped_at": datetime.now().isoformat(),
                    }

                    known_emails.add(email_key)
                    writer.writerow(lead)
                    csv_file.flush()
                    leads_found += 1
                    log.info(f"Lead #{leads_found}: @{username} | {email} | {lead['phone']}")

                    save_lead_to_supabase(lead)
                    known_usernames.add(username_lower)

                    if job_id:
                        update_db_stats(job_id, leads_found, checked)

                    if checked % 10 == 0:
                        with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                            json.dump(list(known_usernames), f)

                    human_delay(checked, hibernate)

                except Exception as e:
                    log.warning(f"Error en barrido manual para @{username}: {e}")
                    continue
        else:
            # Cargar max_id local de compatibilidad si no hay cursor DB y last_username es None
            if last_username is None and cursor_max_id is None:
                cp = cursor_path(target)
                if cp.exists():
                    try:
                        with open(cp, encoding="utf-8") as f:
                            cursor_max_id = json.load(f).get("max_id")
                        if cursor_max_id:
                            log.info(f"Cursor local max_id encontrado: {cursor_max_id[:20]}...")
                            cursor_reached = True
                    except Exception:
                        pass

            while max_followers < 0 or checked < max_followers:
                page_users, next_max_id = get_followers_page(ig_session, target_user_id, cursor_max_id)

                if not page_users:
                    log.info("No hay más seguidores o error al obtener la página.")
                    break

                for user in page_users:
                    if max_followers >= 0 and checked >= max_followers:
                        break

                    username = user.get("username", "")
                    user_id = user.get("pk") or user.get("id")

                    if not username or not user_id:
                        continue

                    # Avanzar hasta la posición del cursor por username (compatibilidad)
                    if not cursor_reached:
                        if username == last_username:
                            cursor_reached = True
                            log.info(f"Cursor encontrado en @{username}. Continuando...")
                        continue

                    checked += 1

                    username_lower = username.lower()
                    if username_lower in known_usernames:
                        if job_id and checked % 20 == 0:
                            update_db_stats(job_id, leads_found, checked)
                        log.info(f"Skip @{username} (ya analizado previamente) [{checked}/{max_followers}]")
                        continue

                    try:
                        full_info = get_user_full_info(ig_session, user_id, accounts, account_idx, username=username)

                        max_rotations = len(accounts) if accounts else 1
                        rotation_attempt = 0
                        while full_info.get("_rate_limited") and rotation_attempt < max_rotations:
                            active = [a for a in accounts if a.get("status") not in ("banned", "expired")]
                            if not active:
                                sys.stderr.write("Error crítico: Todas las cuentas burner en accounts.json han sido bloqueadas o marcadas como 'banned' o 'expired'. El script debe detenerse.\n")
                                sys.exit(1)
                            account_idx = (account_idx + 1) % len(active)
                            L, accounts, account_idx = build_loader()
                            ig_session = L.context._session
                            log.info(f"Rotando a cuenta burner índice {account_idx} (intento {rotation_attempt+1})...")
                            full_info = get_user_full_info(ig_session, user_id, accounts, account_idx, username=username)
                            rotation_attempt += 1

                        if full_info.get("_rate_limited"):
                            log.warning(f"No se pudo obtener info de @{username} tras rotar todas las cuentas burner. Continuando...")
                            continue

                        # Filtrar solo cuentas business/profesionales
                        if not (full_info.get("is_business") or full_info.get("is_professional_account")):
                            known_usernames.add(username_lower)
                            if job_id and (checked % 5 == 0 or checked == max_followers):
                                update_db_stats(job_id, leads_found, checked)
                            if checked % 10 == 0:
                                with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                    json.dump(list(known_usernames), f)
                                log.info(f"Progreso: {checked}/{max_followers} revisados, {leads_found} leads")
                            continue

                        email = (full_info.get("public_email") or "").strip()
                        if not email:
                            known_usernames.add(username_lower)
                            if job_id and (checked % 2 == 0 or checked == max_followers):
                                update_db_stats(job_id, leads_found, checked)
                            if checked % 10 == 0:
                                with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                    json.dump(list(known_usernames), f)
                            continue

                        email_key = email.lower()
                        if email_key in known_emails:
                            log.info(f"Email duplicado, saltando: {email_key}")
                            known_usernames.add(username_lower)
                            if job_id and (checked % 2 == 0 or checked == max_followers):
                                update_db_stats(job_id, leads_found, checked)
                            if checked % 10 == 0:
                                with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                    json.dump(list(known_usernames), f)
                            continue

                        lead = {
                            "username": username,
                            "full_name": (full_info.get("full_name") or "").strip(),
                            "email": email,
                            "phone": str(full_info.get("contact_phone_number") or "").strip(),
                            "website": (full_info.get("external_url") or "").strip(),
                            "bio": (full_info.get("biography") or "").replace("\n", " ").strip(),
                            "category": (full_info.get("category") or full_info.get("category_name") or "").strip(),
                            "followers": full_info.get("follower_count", 0),
                            "following": full_info.get("following_count", 0),
                            "is_verified": full_info.get("is_verified", False),
                            "source_account": target,
                            "scraped_at": datetime.now().isoformat(),
                        }

                        known_emails.add(email_key)
                        writer.writerow(lead)
                        csv_file.flush()
                        leads_found += 1
                        log.info(f"Lead #{leads_found}: @{username} | {email} | {lead['phone']}")

                        save_lead_to_supabase(lead)
                        known_usernames.add(username_lower)
                        
                        if job_id:
                            update_db_stats(job_id, leads_found, checked)

                        if checked % 10 == 0:
                            with open(known_usernames_file_path, "w", encoding="utf-8") as f:
                                json.dump(list(known_usernames), f)
                            log.info(f"Progreso: {checked}/{max_followers} revisados, {leads_found} leads")

                        human_delay(checked, hibernate)

                    except Exception as e:
                        log.warning(f"Error en @{username}: {e}")
                        continue

                if not next_max_id or (max_followers >= 0 and checked >= max_followers):
                    break

                cursor_max_id = next_max_id
                save_cursor(target, username if page_users else "")
                
                # Guardar max_id en el cursor local
                cp = cursor_path(target)
                try:
                    with open(cp, encoding="utf-8") as f:
                        existing = json.load(f)
                except Exception:
                    existing = {}
                existing["max_id"] = next_max_id
                with open(cp, "w", encoding="utf-8") as f:
                    json.dump(existing, f, indent=2)

                # Persistencia del cursor en Supabase si se provee job_id
                if job_id:
                    save_db_cursor(job_id, {
                        "last_username": username if page_users else "",
                        "max_id": next_max_id,
                        "target": target,
                        "saved_at": datetime.now().isoformat()
                    })

    finally:
        csv_file.close()
        with open(known_usernames_file_path, "w", encoding="utf-8") as f:
            json.dump(list(known_usernames), f)
        if job_id:
            try:
                # v1.0.7: Al terminar, actualizar max_followers al total real escaneado
                final_updates = {"leads_found": leads_found, "users_analyzed": checked}
                if max_followers < 0:
                    # Era modo automático: guardar el total real como max_followers
                    final_updates["max_followers"] = checked
                update_db_stats(job_id, leads_found, checked)
                client = get_supabase_client()
                if client and max_followers < 0:
                    client.from_("scraper_jobs").update({"max_followers": checked}).eq("id", job_id).execute()
                    log.info(f"v1.0.7: max_followers actualizado a {checked} (total real escaneado) en Supabase.")
            except Exception as e:
                log.warning(f"Error al escribir stats finales: {e}")

    log.info(f"\nDone. Checked {checked} profiles -> {leads_found} leads saved to {output}")


# ─────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Instagram Lead Scraper")
    parser.add_argument("--target", required=True, help="Target Instagram username")
    parser.add_argument("--output", default="leads.csv", help="Output CSV file")
    parser.add_argument("--max-followers", type=int, default=1000, help="Max followers to scan")
    parser.add_argument("--known-emails", default="", help="Path to JSON file with known emails to skip")
    parser.add_argument("--reset-cursor", action="store_true", help="Ignorar el cursor guardado y empezar desde el principio")
    parser.add_argument("--job-id", default="", help="ID del trabajo en Supabase para persistencia del cursor")
    parser.add_argument("--hibernate", action="store_true", help="Activar modo hibernación con pausas súper seguras")
    parser.add_argument("--usernames", default="", help="Lista de usernames de Instagram separados por comas para barrido manual")
    args = parser.parse_args()

    run(
        target=args.target, 
        output=args.output, 
        max_followers=args.max_followers, 
        known_emails_file=args.known_emails,
        reset=args.reset_cursor,
        job_id=args.job_id,
        hibernate=args.hibernate,
        usernames=args.usernames
    )
