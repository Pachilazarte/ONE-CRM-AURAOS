import requests
from bs4 import BeautifulSoup
import random
import logging
import time
from typing import Dict, List, Optional

log = logging.getLogger(__name__)


class FreeProxyManager:
    """Pool de proxies gratuitos con 3 fuentes, rotación automática y auto-purga."""

    def __init__(self):
        self.proxies: List[str] = []
        self.current_proxy: Optional[str] = None
        self.refresh_proxies()

    def refresh_proxies(self):
        log.info("Extrayendo proxies frescos de múltiples fuentes...")
        new_proxies: set = set()
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

        # Fuente 1: free-proxy-list.net
        try:
            r = requests.get("https://free-proxy-list.net/", headers=headers, timeout=8)
            if r.status_code == 200:
                soup = BeautifulSoup(r.content, "html.parser")
                table = soup.find("table", {"class": "table"})
                if table and table.tbody:
                    for row in table.tbody.find_all("tr")[:40]:
                        cols = row.find_all("td")
                        if len(cols) >= 2:
                            new_proxies.add(f"http://{cols[0].text.strip()}:{cols[1].text.strip()}")
        except Exception as e:
            log.warning(f"Error Fuente 1 (free-proxy-list): {e}")

        # Fuente 2: proxyscrape API
        try:
            r = requests.get(
                "https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all",
                timeout=8,
            )
            if r.status_code == 200:
                for line in r.text.strip().split("\n"):
                    if ":" in line:
                        new_proxies.add(f"http://{line.strip()}")
        except Exception as e:
            log.warning(f"Error Fuente 2 (proxyscrape): {e}")

        # Fuente 3: geonode API
        try:
            r = requests.get(
                "https://proxylist.geonode.com/api/proxy-list?limit=50&page=1&sort_by=lastChecked&sort_type=desc&protocols=http%2Chttps",
                timeout=8,
            )
            if r.status_code == 200:
                for item in r.json().get("data", []):
                    new_proxies.add(f"http://{item['ip']}:{item['port']}")
        except Exception as e:
            log.warning(f"Error Fuente 3 (geonode): {e}")

        self.proxies = list(new_proxies)
        random.shuffle(self.proxies)
        log.info(f"Pool cargado con {len(self.proxies)} proxies únicos.")
        self.current_proxy = self.proxies[0] if self.proxies else None

    def get_proxy_dict(self) -> Optional[Dict[str, str]]:
        if not self.current_proxy:
            if not self.proxies:
                self.refresh_proxies()
            if self.proxies:
                self.current_proxy = self.proxies[0]
            else:
                return None
        return {"http": self.current_proxy, "https": self.current_proxy}

    def purge_and_rotate(self):
        if self.current_proxy in self.proxies:
            log.warning(f"Eliminando proxy quemado: {self.current_proxy}")
            self.proxies.remove(self.current_proxy)
        if len(self.proxies) < 5:
            log.info("Pocos proxies restantes. Recargando pool...")
            self.refresh_proxies()
        if self.proxies:
            self.current_proxy = self.proxies[0]
            log.info(f"Rotado a: {self.current_proxy} ({len(self.proxies)} restantes)")
        else:
            self.current_proxy = None

    def apply_human_delay(self):
        time.sleep(random.uniform(2.0, 5.0))


_proxy_manager: Optional[FreeProxyManager] = None


def get_proxy_manager() -> FreeProxyManager:
    global _proxy_manager
    if _proxy_manager is None:
        _proxy_manager = FreeProxyManager()
    return _proxy_manager