"""
Best-effort scraper for the Eurolite freeDMX AP's own embedded web config
page — reached at e.g. http://192.168.4.1 once your PC (or phone) is
joined to the device's own WiFi access point (the "freeDMX_AP_xxxxxx"
network; see CLAUDE.md in this repo for the full connection walkthrough).

IMPORTANT HONESTY NOTE: this repo has the *manual's screenshots* of that
web UI (tabs: Home/Übersicht, General, Access Point, Network, Artnet,
Info — printed user manual "EUROLITE freeDMX AP Wi-Fi Interface",
No. 51860130, pages 8-9 / 18-19 in the DE/EN edition) but not that page's
actual HTML source, and the manual doesn't document the tabs' individual
URLs (it reads as a single JS/tab-driven page). The regexes below are
best-effort guesses at what a rendered config page is likely to contain
(IP-shaped strings, "UDP" near a number, "Universe" near a digit, etc.)
— they are NOT verified against a live device and may miss entirely or
match something unrelated on a given firmware version's markup. Treat
any match as a *lead to check by eye*, never a certainty.

The raw HTML is always saved to disk regardless of whether the regexes
find anything — specifically so a human (or another tool) can read it
directly when the guesses above miss.

Manufacturer product page (for firmware/manual updates):
https://www.steinigke.de/en/mpn51860130-eurolite-freedmx-ap-wi-fi-interface.html
"""

from __future__ import annotations

import re
import urllib.error
import urllib.request
from pathlib import Path

IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
SSID_RE = re.compile(r"freeDMX_AP_[0-9A-Fa-f]{6}", re.IGNORECASE)
PORT_NEAR_RE = re.compile(r"(?:UDP|Port)[^\d]{0,20}(\d{2,5})", re.IGNORECASE)
UNIVERSE_NEAR_RE = re.compile(r"(?:Universe|Univers)[^\d]{0,20}(\d{1,3})", re.IGNORECASE)
NET_SUBNET_NEAR_RE = re.compile(r"(?:Net|Sub[- ]?net)[^\d]{0,20}(\d{1,3})", re.IGNORECASE)

# The manual's screenshots show a tabbed single page, so these sub-paths
# are guesses worth trying, not confirmed routes — only "/" is something
# we can actually trust based on the manual (§ "Wie Sie das freeDMX in
# ein bestehendes Netzwerk einbinden": http://192.168.4.1 shows the whole
# config UI directly).
CANDIDATE_PATHS = ["/", "/index.html", "/general", "/network", "/artnet", "/info", "/status", "/config"]


def fetch(url: str, timeout: float = 5.0) -> str | None:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except (urllib.error.URLError, OSError):
        return None


def scrape(host: str, out_dir: Path) -> dict:
    """Fetches the device's root config page (and a few guessed sub-paths),
    saves the raw HTML for manual inspection, and does a best-effort regex
    pass over all of it for anything IP/port/universe-shaped."""
    result: dict = {
        "reachable": False,
        "pages_fetched": [],
        "possible_ips": set(),
        "possible_ssids": set(),
        "possible_ports": set(),
        "possible_universes": set(),
        "possible_net_subnet": set(),
    }

    combined_html: list[str] = []
    for path in CANDIDATE_PATHS:
        url = f"http://{host}{path}"
        html = fetch(url)
        if html is None:
            continue
        result["reachable"] = True
        result["pages_fetched"].append(url)
        combined_html.append(html)
        safe_name = path.strip("/").replace("/", "_") or "root"
        (out_dir / f"device_page_{safe_name}.html").write_text(html, encoding="utf-8")

    full_text = "\n".join(combined_html)
    if full_text:
        result["possible_ips"] = set(IP_RE.findall(full_text))
        result["possible_ssids"] = set(SSID_RE.findall(full_text))
        result["possible_ports"] = set(PORT_NEAR_RE.findall(full_text))
        result["possible_universes"] = set(UNIVERSE_NEAR_RE.findall(full_text))
        result["possible_net_subnet"] = set(NET_SUBNET_NEAR_RE.findall(full_text))

    return result
