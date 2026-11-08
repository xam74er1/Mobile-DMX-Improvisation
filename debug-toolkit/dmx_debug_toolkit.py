#!/usr/bin/env python3
"""
DMX Improvisator - network debug toolkit
=========================================

Run this on a laptop/PC (joined to the same WiFi as your Eurolite
freeDMX AP - the "freeDMX_AP_xxxxxx" network, or your venue WiFi if the
AP is bridged into it) when the mobile app isn't reaching a real fixture
and the phone alone doesn't give you enough to go on.

It tries **all four** protocols this app can speak: real Art-Net UDP,
the device's own original proprietary UDP protocol, and the WS/HTTP
bridge protocol (for isolating app-logic bugs from real-hardware ones),
against the same target, logs every packet sent and any reply received,
and writes both a machine-readable (JSON-Lines) and a human-readable
export you can attach to a bug report or hand to someone else entirely.

It also makes a best-effort attempt to read the device's own web config
page (see device_info.py for an important honesty note about how
reliable that part is) and sanity-checks your own PC's network situation
before trying any DMX protocol at all.

Companion reading in this repo:
  - docs/DMX_PACKET_PROTOCOL.md - the full byte-level protocol reference
    every probe here is implemented against.
  - CLAUDE.md -> "Debugging a Failed Show / Connection" - the non-code
    checklist (wrong WiFi, wrong DMX address on the fixture, etc.) that
    this toolkit complements rather than replaces.

External references:
  - Art-Net 4 spec: https://legacy.vvvv.org/sites/default/files/user-files/art-net.pdf
  - freeDMX AP product page: https://www.steinigke.de/en/mpn51860130-eurolite-freedmx-ap-wi-fi-interface.html
  - freeDMX native protocol reverse-engineering: https://github.com/rdejeun/qlcplus/tree/freedmx/plugins/freedmx
  - Wireshark, for real below-the-application-layer packet capture: https://www.wireshark.org/

Usage:
    pip install -r requirements.txt
    python dmx_debug_toolkit.py --host 192.168.4.1

    # only some protocols, custom ports, hold the blink test longer:
    python dmx_debug_toolkit.py --host 192.168.4.1 --artnet --freedmx --blink-hold 1.5

    # point WS/HTTP at the desktop visualizer bridge instead:
    python dmx_debug_toolkit.py --host 127.0.0.1 --ws --http --ws-port 8080 --http-port 8081
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import artnet_probe
import device_info
import freedmx_native_probe
import netcheck
import web_bridge_probe
from packet_log import PacketLog

BANNER = r"""
============================================================
 DMX Improvisator -- network debug toolkit
 docs/DMX_PACKET_PROTOCOL.md has the full protocol reference
============================================================
"""


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Debug toolkit for the Mobile DMX Improvisator app's DMX transports.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--host", default="192.168.4.1", help="Receiver IP (default: freeDMX AP factory IP, 192.168.4.1)")
    p.add_argument("--artnet-port", type=int, default=6454, help="UDP port for the Art-Net probe (default: 6454, the fixed Art-Net-standard port -- NOT the device's General UDP-Port; see docs/DMX_PACKET_PROTOCOL.md section 1)")
    p.add_argument("--port", type=int, default=10100, help="UDP port for the freeDMX-native probe (default: 10100, this device's factory General UDP-Port -- a separate, proprietary protocol, unrelated to --artnet-port)")
    p.add_argument("--universe", type=int, default=0, help="Art-Net universe (default: 0)")
    p.add_argument("--ws-port", type=int, default=8080, help="WebSocket bridge port (default: 8080)")
    p.add_argument("--http-port", type=int, default=8081, help="HTTP bridge port (default: 8081)")
    p.add_argument("--http-path", default="/dmx", help="HTTP bridge path (default: /dmx)")
    p.add_argument("--blink-hold", type=float, default=0.6, help="Seconds to hold each blink test's ON state (default: 0.6)")

    p.add_argument("--artnet", action="store_true", help="Run only the Art-Net probe")
    p.add_argument("--freedmx", action="store_true", help="Run only the freeDMX-native probe")
    p.add_argument("--ws", action="store_true", help="Run only the WebSocket bridge probe")
    p.add_argument("--http", action="store_true", help="Run only the HTTP bridge probe")

    p.add_argument("--no-scrape", action="store_true", help="Skip trying to read the device's own web config page")
    p.add_argument("--no-netcheck", action="store_true", help="Skip the local network self-check (get local IP, ping target)")
    p.add_argument("--out-dir", default=None, help="Directory to write logs/exports into (default: debug-session-<timestamp>/ next to this script)")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    # If no specific protocol flag was given, run all four.
    run_all = not (args.artnet or args.freedmx or args.ws or args.http)

    out_dir = Path(args.out_dir) if args.out_dir else Path(__file__).parent / f"debug-session-{time.strftime('%Y%m%d-%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(BANNER)
    print(f"Target:      {args.host}:{args.artnet_port} (Art-Net)  /  {args.host}:{args.port} (freeDMX-native)")
    print(f"Bridge:      ws://{args.host}:{args.ws_port}   http://{args.host}:{args.http_port}{args.http_path}")
    print(f"Output dir:  {out_dir}\n")

    log = PacketLog()

    # ---- Step 1: local network self-check ---------------------------------
    if not args.no_netcheck:
        print("--- Step 1: local network self-check " + "-" * 30)
        local_ip = netcheck.get_local_ip()
        print(f"This machine's outbound IP: {local_ip}")
        if local_ip.startswith("192.168.4."):
            print("  -> looks like you're on the freeDMX AP's own access point subnet, good.")
        else:
            print("  -> NOT on the 192.168.4.x subnet. If you're targeting the AP's own WiFi")
            print("     ('freeDMX_AP_xxxxxx'), this PC probably isn't joined to it - the #1")
            print("     real-world cause of 'nothing responds' (see CLAUDE.md).")
        reachable = netcheck.ping(args.host)
        print(f"ping {args.host}: {'reachable' if reachable else 'NO REPLY'}")
        if not reachable:
            print("  -> no ICMP reply doesn't always mean 'unreachable' (some devices/firewalls")
            print("     drop ping but still answer UDP) - but it's a strong early signal to check")
            print("     the WiFi network before spending time on protocol-level debugging.")
        print()

    # ---- Step 2: device web-config scrape ----------------------------------
    if not args.no_scrape:
        print("--- Step 2: device web config (best-effort) " + "-" * 16)
        info = device_info.scrape(args.host, out_dir)
        if info["reachable"]:
            print(f"Reached: {', '.join(info['pages_fetched'])}")
            print(f"Raw HTML saved to {out_dir}\\device_page_*.html - read these yourself, the")
            print("matches below are guesses (see device_info.py's docstring for why):")
            for label, key in (
                ("possible IPs", "possible_ips"),
                ("possible SSIDs", "possible_ssids"),
                ("possible ports", "possible_ports"),
                ("possible universe values", "possible_universes"),
                ("possible net/subnet values", "possible_net_subnet"),
            ):
                vals = sorted(info[key])
                if vals:
                    print(f"  {label}: {', '.join(vals)}")
        else:
            print(f"Could not reach http://{args.host}/ at all - either this PC isn't on the")
            print("device's network, or its web config server is at a different address.")
            print("This does NOT mean DMX itself won't work - the web config and the DMX")
            print("listener are separate services on the device.")
        print()

    # ---- Step 3: protocol probes -------------------------------------------
    print("--- Step 3: protocol probes " + "-" * 35)
    results: dict = {}

    if run_all or args.artnet:
        print(f"\n[Art-Net]  ArtPoll broadcast + ArtDMX blink to {args.host}:{args.artnet_port} ...")
        results["artnet"] = artnet_probe.probe(args.host, args.artnet_port, args.universe, log, blink_hold=args.blink_hold)
        r = results["artnet"]
        poll_note = f" ({r['poll_error']})" if r.get("poll_error") else ""
        print(f"  ArtPollReply nodes seen: {len(r['nodes_found'])}{poll_note}")
        for n in r["nodes_found"]:
            print(f"    - {n['ip']}  short={n['short_name']!r}  long={n['long_name']!r}")
        dmx_note = f"  error: {r['dmx_error']}" if r.get("dmx_error") else ""
        print(f"  ArtDMX blink sent: {r['dmx_sent']}{dmx_note}")

    if run_all or args.freedmx:
        print(f"\n[freeDMX Native]  hello + blink to {args.host}:{args.port}, listening for replies ...")
        results["freedmx"] = freedmx_native_probe.probe(args.host, args.port, log, blink_hold=args.blink_hold)
        r = results["freedmx"]
        print(f"  hello sent: {r['hello_sent']}")
        print(f"  replies captured: {len(r['replies'])}")
        for reply in r["replies"]:
            print(f"    - from {reply['from']}: {reply['note']}  ({reply['hex']})")
        if not r["replies"]:
            print("  (no reply at all - the reference app doesn't wait for one either, so this")
            print("   alone isn't conclusive; see docs/DMX_PACKET_PROTOCOL.md section 7.1)")
        frame_note = f"  error: {r['frame_error']}" if r.get("frame_error") else ""
        print(f"  channel frame sent: {r['frame_sent']}{frame_note}")

    if run_all or args.ws:
        print(f"\n[WebSocket bridge]  ws://{args.host}:{args.ws_port} ...")
        results["ws"] = web_bridge_probe.ws_probe(args.host, args.ws_port, args.universe, log, blink_hold=args.blink_hold)
        r = results["ws"]
        err_note = f"  error: {r['error']}" if r.get("error") else ""
        print(f"  connected: {r['connected']}{err_note}")
        print(f"  sent: {r['sent']}")

    if run_all or args.http:
        print(f"\n[HTTP bridge]  http://{args.host}:{args.http_port}{args.http_path} ...")
        results["http"] = web_bridge_probe.http_probe(args.host, args.http_port, args.http_path, args.universe, log, blink_hold=args.blink_hold)
        r = results["http"]
        err_note = f"  error: {r['error']}" if r.get("error") else ""
        print(f"  sent: {r['sent']}  status: {r['status']}{err_note}")

    # ---- Step 4: export -----------------------------------------------------
    print("\n--- Step 4: export " + "-" * 43)
    jsonl_path = out_dir / "packets.jsonl"
    text_path = out_dir / "packets.txt"
    log.export_jsonl(jsonl_path)
    log.export_text(text_path)
    print(f"Raw packet log ({len(log.entries)} entries):")
    print(f"  {jsonl_path}   (machine-readable, one JSON object per line)")
    print(f"  {text_path}   (human-readable hex dump)")
    print(f"\nAttach the whole '{out_dir.name}' directory to a bug report, or hand it to")
    print("whoever's helping debug this - it's everything this script sent and received,")
    print("plus the device's raw web-config HTML if it was reachable.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
