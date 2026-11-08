"""
WebSocket + HTTP probe — for testing against this repo's own desktop
visualizer bridge (dmx-visualizer/server/server.py), NOT real hardware
directly. The freeDMX AP doesn't speak either of these protocols; see
docs/DMX_PACKET_PROTOCOL.md §6. This is useful for isolating "is my DMX
pipeline logic correct" from "is the network path to the real device
correct" — if this passes but the real device never lights up, the bug
is somewhere in the network/device path, not in how frames are built.

WebSocket client: requires the `websockets` package
(https://websockets.readthedocs.io/) — already a dependency of the
sibling dmx-visualizer/server project in this repo, see its
requirements.txt.
HTTP client: standard library only
(https://docs.python.org/3/library/urllib.request.html).
"""

from __future__ import annotations

import asyncio
import json
import time
import urllib.error
import urllib.request

from packet_log import PacketLog


def _make_body(universe: int, channels: bytes) -> bytes:
    return json.dumps({"type": "SEND_DMX", "universe": universe, "data": list(channels)}).encode("utf-8")


async def _ws_probe_async(host: str, port: int, universe: int, log: PacketLog, blink_hold: float) -> dict:
    import websockets  # imported lazily so the rest of the toolkit still runs without this package installed

    result: dict = {"connected": False, "dmx_data_on_connect": None, "sent": False, "error": None}
    url = f"ws://{host}:{port}"
    try:
        async with websockets.connect(url, open_timeout=5) as ws:
            result["connected"] = True

            # dmx-visualizer/server/server.py sends the bridge's current
            # universe state right after a client connects — capture it,
            # it's free debug info about what the bridge currently thinks
            # the state is, independent of anything we're about to send.
            try:
                first = await asyncio.wait_for(ws.recv(), timeout=1.5)
                first_bytes = first.encode() if isinstance(first, str) else first
                result["dmx_data_on_connect"] = first[:500] if isinstance(first, str) else repr(first[:500])
                log.log("ws", "rx", host, port, first_bytes, summary="initial DMX_DATA on connect")
            except asyncio.TimeoutError:
                pass

            on = bytes([255]) * 512
            off = bytes(512)
            body_on = _make_body(universe, on)
            body_off = _make_body(universe, off)

            await ws.send(body_on)
            log.log("ws", "tx", host, port, body_on, summary="SEND_DMX blink ON")
            try:
                reply = await asyncio.wait_for(ws.recv(), timeout=1.5)
                reply_bytes = reply.encode() if isinstance(reply, str) else reply
                log.log("ws", "rx", host, port, reply_bytes, summary="broadcast reply after ON")
            except asyncio.TimeoutError:
                pass

            await asyncio.sleep(blink_hold)

            await ws.send(body_off)
            log.log("ws", "tx", host, port, body_off, summary="SEND_DMX blink OFF")
            result["sent"] = True
    except Exception as e:  # noqa: BLE001 — deliberately broad: this is a diagnostic tool, report *any* failure to the user
        result["error"] = str(e)
        log.log("ws", "tx", host, port, b"", summary="WS probe failed", ok=False, error=str(e))
    return result


def ws_probe(host: str, port: int, universe: int, log: PacketLog, blink_hold: float = 0.6) -> dict:
    try:
        return asyncio.run(_ws_probe_async(host, port, universe, log, blink_hold))
    except ImportError:
        return {
            "connected": False,
            "error": "the 'websockets' package isn't installed — run: pip install -r requirements.txt",
        }


def http_probe(host: str, port: int, path: str, universe: int, log: PacketLog, blink_hold: float = 0.6) -> dict:
    result: dict = {"sent": False, "status": None, "error": None}
    url = f"http://{host}:{port}{path}"

    def post(frame: bytes, label: str) -> None:
        body = _make_body(universe, frame)
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                result["status"] = resp.status
                log.log("http", "tx", host, port, body, summary=f"POST {path} {label} -> HTTP {resp.status}")
        except urllib.error.HTTPError as e:
            result["status"] = e.code
            result["error"] = f"HTTP {e.code}"
            log.log("http", "tx", host, port, body, summary=f"POST {path} {label} -> HTTP {e.code}", ok=False, error=str(e))
        except urllib.error.URLError as e:
            result["error"] = str(e.reason)
            log.log("http", "tx", host, port, body, summary=f"POST {path} {label} -> unreachable", ok=False, error=str(e.reason))

    on = bytes([255]) * 512
    off = bytes(512)
    post(on, "blink ON")
    if result["error"] is None:
        time.sleep(blink_hold)
        post(off, "blink OFF")
        result["sent"] = result["error"] is None

    return result
