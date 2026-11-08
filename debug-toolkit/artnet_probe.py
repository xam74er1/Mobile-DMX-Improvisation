"""
Art-Net probe: builds and sends real ArtDMX/ArtPoll packets, and listens
for ArtPollReply. This is a byte-for-byte match of this repo's own
src/dmx/ArtNetClient.ts, so a capture from this script is directly
comparable to one exported from the app's own Debug Console.

Spec reference: Art-Net 4 Protocol Specification (Artistic Licence
Engineering) — a mirror is linked from this repo's own
docs/DMX_PACKET_PROTOCOL.md §11.1:
https://legacy.vvvv.org/sites/default/files/user-files/art-net.pdf

Official protocol homepage: https://art-net.org.uk/

Full byte-level breakdown this implementation follows:
docs/DMX_PACKET_PROTOCOL.md §5 in this repo.
"""

from __future__ import annotations

import socket
import time
from dataclasses import dataclass
from typing import Optional

from packet_log import PacketLog

ARTNET_STD_PORT = 6454  # the Art-Net *standard* port — only used here to listen for ArtPollReply


def build_artdmx_packet(universe: int, channels: bytes, sequence: int) -> bytes:
    dmx_len = min(512, len(channels))
    padded = dmx_len if dmx_len % 2 == 0 else dmx_len + 1
    packet = bytearray(18 + padded)
    packet[0:8] = b"Art-Net\x00"
    packet[8] = 0x00
    packet[9] = 0x50  # OpCode ArtDMX = 0x5000, little-endian
    packet[10] = 0x00
    packet[11] = 0x0E  # ProtVer 14, big-endian
    packet[12] = sequence & 0xFF
    packet[13] = 0x00  # Physical, unused
    packet[14] = universe & 0xFF
    packet[15] = (universe >> 8) & 0x7F
    packet[16] = (padded >> 8) & 0xFF
    packet[17] = padded & 0xFF
    packet[18 : 18 + dmx_len] = channels[:dmx_len]
    return bytes(packet)


def build_artpoll_packet() -> bytes:
    packet = bytearray(14)
    packet[0:8] = b"Art-Net\x00"
    packet[8] = 0x00
    packet[9] = 0x20  # OpCode ArtPoll = 0x2000
    packet[10] = 0x00
    packet[11] = 0x0E
    packet[12] = 0x00  # TalkToMe
    packet[13] = 0x00  # Priority
    return bytes(packet)


@dataclass
class ArtPollReplyNode:
    ip: str
    short_name: str
    long_name: str


def parse_artpollreply(data: bytes, source_ip: str) -> Optional[ArtPollReplyNode]:
    if len(data) < 10 or data[0:7] != b"Art-Net":
        return None
    opcode = data[8] | (data[9] << 8)
    if opcode != 0x2100:
        return None

    def read_cstr(offset: int, max_len: int) -> str:
        end = offset
        limit = min(len(data), offset + max_len)
        while end < limit and data[end] != 0:
            end += 1
        return data[offset:end].decode("ascii", errors="replace").strip()

    return ArtPollReplyNode(ip=source_ip, short_name=read_cstr(26, 18), long_name=read_cstr(44, 64))


def probe(
    host: str,
    port: int,
    universe: int,
    log: PacketLog,
    poll_timeout: float = 2.5,
    blink_hold: float = 0.6,
) -> dict:
    """Broadcasts an ArtPoll and listens for replies, then sends a blink
    test (all channels full, then off) directly to host:port. Many
    budget Art-Net-over-WiFi adapters (the Eurolite freeDMX AP included,
    per CLAUDE.md in this repo) never send ArtPollReply at all — zero
    nodes found here does NOT mean the ArtDMX blink below won't work."""
    result: dict = {"nodes_found": [], "poll_error": None, "dmx_sent": False, "dmx_error": None}

    # --- ArtPoll discovery ---------------------------------------------
    poll_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    poll_sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    try:
        try:
            poll_sock.bind(("0.0.0.0", ARTNET_STD_PORT))
        except OSError:
            # Already in use (e.g. dmx-visualizer's own server, or another
            # instance of this script) — sending still works, we just
            # might miss unicast replies aimed specifically at port 6454.
            pass

        poll_packet = build_artpoll_packet()
        poll_sock.sendto(poll_packet, ("255.255.255.255", ARTNET_STD_PORT))
        log.log("artnet", "tx", "255.255.255.255", ARTNET_STD_PORT, poll_packet, summary="ArtPoll broadcast")

        seen_ips: set[str] = set()
        deadline = time.time() + poll_timeout
        while time.time() < deadline:
            poll_sock.settimeout(max(0.05, deadline - time.time()))
            try:
                data, addr_info = poll_sock.recvfrom(2048)
            except socket.timeout:
                break
            except OSError as e:
                result["poll_error"] = str(e)
                break
            addr = addr_info[0]
            node = parse_artpollreply(data, addr)
            if node and addr not in seen_ips:
                seen_ips.add(addr)
                result["nodes_found"].append(node.__dict__)
                log.log(
                    "artnet", "rx", addr, ARTNET_STD_PORT, data,
                    summary=f"ArtPollReply from {addr}: short={node.short_name!r} long={node.long_name!r}",
                )
    finally:
        poll_sock.close()

    # --- ArtDMX blink test ------------------------------------------------
    dmx_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        on = bytes([255]) * 512
        off = bytes(512)

        pkt_on = build_artdmx_packet(universe, on, sequence=1)
        dmx_sock.sendto(pkt_on, (host, port))
        log.log("artnet", "tx", host, port, pkt_on, summary="ArtDMX blink ON (all 512 channels = 255)")

        time.sleep(blink_hold)

        pkt_off = build_artdmx_packet(universe, off, sequence=2)
        dmx_sock.sendto(pkt_off, (host, port))
        log.log("artnet", "tx", host, port, pkt_off, summary="ArtDMX blink OFF (all 512 channels = 0)")

        result["dmx_sent"] = True
    except OSError as e:
        result["dmx_error"] = str(e)
        log.log("artnet", "tx", host, port, b"", summary="ArtDMX blink failed", ok=False, error=str(e))
    finally:
        dmx_sock.close()

    return result
