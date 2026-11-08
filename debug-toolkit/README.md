# DMX Debug Toolkit

A standalone Python toolkit you run on a laptop/PC when the mobile app
isn't reaching a real fixture and the phone alone doesn't give you
enough to diagnose it. It's independent of the mobile app and the
desktop visualizer — it doesn't need either one running.

It tries **all four transports** the app can speak — real Art-Net UDP,
the Eurolite freeDMX AP's own original proprietary UDP protocol, and the
WebSocket/HTTP bridge protocol — against the same target, logs every
packet it sends and any reply it receives, and exports the whole session
so it can be attached to a bug report or handed to someone else entirely
without them needing to reproduce anything themselves.

For the full byte-level explanation of what each protocol actually is
and why this device needs more than one, read
[`docs/DMX_PACKET_PROTOCOL.md`](../docs/DMX_PACKET_PROTOCOL.md) in the
repo root — every probe in this toolkit is a direct implementation of
what that document describes. For the non-code checklist (wrong WiFi,
wrong DMX address on the fixture, fixture in stand-alone mode, etc.),
see `CLAUDE.md` → "Debugging a Failed Show / Connection".

## What it does

1. **Local network self-check** — is this PC even on the right network?
   Reports the machine's outbound IP and whether the target host
   answers a ping, before trying anything DMX-specific.
2. **Device web-config scrape (best-effort)** — tries to fetch the
   freeDMX AP's own config page at `http://<host>/` and saves the raw
   HTML, plus a best-effort regex pass looking for IP/port/universe-
   shaped values. See the honesty note at the top of `device_info.py` —
   this is a lead to check by eye, not a guaranteed-accurate parse.
3. **Art-Net probe** — broadcasts an ArtPoll (listens for ArtPollReply),
   then sends a real ArtDMX blink test (every channel full, then off)
   straight to the target.
4. **freeDMX-native probe** — sends the device's original protocol's
   hello handshake and *actively listens* for a reply (the app itself
   doesn't, deliberately — this tool does, since more information is
   always useful when debugging), then sends the same blink test packed
   into that protocol's own 3-bytes-per-channel frame format.
5. **WebSocket / HTTP bridge probe** — for testing against the desktop
   visualizer bridge (`dmx-visualizer/server/server.py`) instead of real
   hardware, to isolate "is my DMX logic correct" from "is the network
   path to the device correct."
6. **Export** — every packet sent/received, as both a JSON-Lines file
   (for scripts/notebooks) and a human-readable hex dump, in a
   timestamped `debug-session-.../` folder.

## Usage

```bash
pip install -r requirements.txt

# run every protocol against the freeDMX AP's factory defaults
python dmx_debug_toolkit.py --host 192.168.4.1

# only some protocols, custom ports, hold the blink test longer
python dmx_debug_toolkit.py --host 192.168.4.1 --artnet --freedmx --blink-hold 1.5

# point WS/HTTP at the desktop visualizer bridge instead of real hardware
python dmx_debug_toolkit.py --host 127.0.0.1 --ws --http --ws-port 8080 --http-port 8081

# see every option
python dmx_debug_toolkit.py --help
```

On Windows, double-click **`run-debug-toolkit.bat`** to install
dependencies and run it against the factory defaults (`192.168.4.1`, port
`6454` for the Art-Net probe and `10100` for the freeDMX-native probe) in
one step.

## Files

| File | Role |
|---|---|
| `dmx_debug_toolkit.py` | CLI entry point — orchestrates every probe and prints/exports the report |
| `packet_log.py` | Shared packet-logging helper — records every tx/rx, exports JSON-Lines + hex-dump text |
| `netcheck.py` | Local machine's outbound IP + ping, for the network self-check |
| `artnet_probe.py` | Real Art-Net (ArtPoll + ArtDMX), matches `src/dmx/ArtNetClient.ts` byte-for-byte |
| `freedmx_native_probe.py` | The device's original proprietary protocol, matches `src/dmx/FreeDMXNativeClient.ts` byte-for-byte |
| `web_bridge_probe.py` | WebSocket + HTTP probes against the desktop visualizer bridge |
| `device_info.py` | Best-effort scrape of the device's own web config page |
| `requirements.txt` | Only dependency: `websockets` (same version pinned by `dmx-visualizer/server`) |
| `run-debug-toolkit.bat` | Windows one-click launcher against factory defaults |

## Prerequisites

- Python 3.9+ (uses `from __future__ import annotations` and f-strings; no other version-specific features)
- `pip install -r requirements.txt` (just `websockets`; everything else is standard library)
- Your PC needs to actually be able to reach the target — join the
  freeDMX AP's own WiFi (`freeDMX_AP_xxxxxx`) the same way you'd join
  your phone to it, or be on the same network it's bridged into.

## Further reading

- Art-Net 4 Protocol Specification (Artistic Licence Engineering): <https://legacy.vvvv.org/sites/default/files/user-files/art-net.pdf>
- Art-Net protocol homepage: <https://art-net.org.uk/>
- Eurolite freeDMX AP product page (manual/firmware downloads): <https://www.steinigke.de/en/mpn51860130-eurolite-freedmx-ap-wi-fi-interface.html>
- freeDMX native-protocol reverse-engineering (source for `freedmx_native_probe.py`): <https://github.com/rdejeun/qlcplus/tree/freedmx/plugins/freedmx>, forum context: <https://qlcplus.org/forum/viewtopic.php?t=11593>
- `websockets` library docs: <https://websockets.readthedocs.io/>
- Wireshark — for real packet capture below the application layer (this toolkit's own log only records what it itself sent/received at the socket API level, not retransmits/ARP/ICMP/etc.): <https://www.wireshark.org/>
