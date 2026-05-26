"""
Residential proxy configuration for Instagram scraping.

Free datacenter proxies (the old proxy_manager.py approach) are blocked by Meta
at the ASN level before any request is processed. A paid rotating residential proxy
service routes traffic through real home IPs, which pass Meta's threat intelligence.

Supported providers (set PROXY_HOST / PROXY_PORT accordingly):
  SmartProxy rotating:  gate.smartproxy.com       port 7000
  SmartProxy sticky:    gate.smartproxy.com        port 10001
  BrightData rotating:  zproxy.lum-superproxy.io  port 22225
  Oxylabs rotating:     pr.oxylabs.io             port 7777

Required env vars:
  PROXY_HOST   hostname of the proxy gateway
  PROXY_PORT   port number
  PROXY_USER   username (from your provider dashboard)
  PROXY_PASS   password (from your provider dashboard)
"""

import os
import logging

log = logging.getLogger(__name__)


def get_proxy_url(session_name: str = None) -> str | None:
    host = os.getenv("PROXY_HOST", "").strip()
    port = os.getenv("PROXY_PORT", "").strip()
    user = os.getenv("PROXY_USER", "").strip()
    pwd  = os.getenv("PROXY_PASS", "").strip()

    if not host or not port:
        return None

    if user and pwd:
        if session_name:
            # Sanitizar session_name para que tenga caracteres alfanuméricos válidos
            clean_name = "".join(c for c in session_name if c.isalnum() or c in "-_")
            if "-session-" not in user:
                user = f"{user}-session-{clean_name}"
        return f"http://{user}:{pwd}@{host}:{port}"
    return f"http://{host}:{port}"


def get_proxy_dict(session_name: str = None) -> dict | None:
    url = get_proxy_url(session_name)
    if not url:
        return None
    return {"http": url, "https": url}


def apply_to_session(session, session_name: str = None) -> None:
    """Inject residential proxy into a requests.Session or curl_cffi.requests.Session (in-place)."""
    url = get_proxy_url(session_name)
    if url:
        # En curl_cffi.requests.Session, proxies puede ser un dict que se asigna o se actualiza
        if hasattr(session, "proxies"):
            if isinstance(session.proxies, dict):
                session.proxies.update({"http": url, "https": url})
            else:
                session.proxies = {"http": url, "https": url}
        log.info(f"Residential proxy applied (sticky session: {session_name or 'rotating'}): {os.getenv('PROXY_HOST')}:{os.getenv('PROXY_PORT')}")
    else:
        log.warning(
            "No residential proxy configured. "
            "Set PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS. "
            "Instagram will block datacenter and direct IPs."
        )