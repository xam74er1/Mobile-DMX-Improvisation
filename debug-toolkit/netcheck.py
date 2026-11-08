"""
Local-machine network self-check — mirrors what the app's own
NetworkStatusCard shows on the phone (src/utils/networkInfo.ts and
src/store/... in this repo), but for the PC running this script. Uses
only the standard library.

Background reading: the #1 real-world cause of "nothing responds" with
this device is simply not being on its WiFi network at all — see
CLAUDE.md → "Debugging a Failed Show / Connection", item 4. This module
exists to catch that before spending any time on protocol-level
debugging.
"""

from __future__ import annotations

import platform
import socket
import subprocess


def get_local_ip() -> str:
    """Best-effort local IP: asks the OS which interface it would use to
    route toward 8.8.8.8, without actually sending anything (a UDP socket's
    connect() just picks a route/local address, it never puts a packet on
    the wire) — the same trick dmx-visualizer/server/server.py's own
    get_local_ip() uses."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


def ping(host: str, timeout_s: float = 1.5) -> bool:
    """Shells out to the OS's own ping — one echo request, cross-platform.
    Returns True only on a real reply. Note a False here isn't always
    conclusive: some devices/firewalls drop ICMP but still answer UDP —
    treat it as a strong early signal, not final proof either way."""
    is_windows = platform.system().lower() == "windows"
    count_flag = "-n" if is_windows else "-c"
    timeout_flag = "-w" if is_windows else "-W"
    timeout_val = str(int(timeout_s * 1000)) if is_windows else str(max(1, int(timeout_s)))
    try:
        proc = subprocess.run(
            ["ping", count_flag, "1", timeout_flag, timeout_val, host],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout_s + 2,
        )
        return proc.returncode == 0
    except (OSError, subprocess.TimeoutExpired):
        return False
