"""
freeDMX-native probe: speaks the Eurolite freeDMX AP's *original*
proprietary protocol — reverse-engineered from the device's own factory
app (Steinigke Light'J) via a QLC+ plugin, not from any public spec. A
byte-for-byte match of this repo's src/dmx/FreeDMXNativeClient.ts.

Unlike the app itself — which is deliberately fire-and-forget, see the
comment at the top of FreeDMXNativeClient.ts for why — THIS debug tool
actively listens on the socket after sending, hoping to catch the
device's documented ack bytes (`A7` `AA`) and its once-a-second heartbeat
(`F0 64`), or just as usefully, whatever *unexpected* bytes come back on
real hardware. We're debugging here, not shipping — more information is
strictly better even if we never act on it automatically.

Primary source for this protocol (reverse-engineered, CC BY-SA 4.0):
https://github.com/rdejeun/qlcplus/tree/freedmx/plugins/freedmx
Forum context: https://qlcplus.org/forum/viewtopic.php?t=11593
Full write-up with the exact byte layout: docs/DMX_PACKET_PROTOCOL.md
§7 and §11.3 in this repo.
"""

from __future__ import annotations

import socket
import time

from packet_log import PacketLog

FRAME_MAX_CHANNEL = 512
FRAME_BYTES_PER_CHANNEL = 3
DATAGRAM_MAX_SIZE = 250

HELLO = bytes([0xE5, 0x39, 0x60, 0x00])
BYE = bytes([0xAC, 0x00])

KNOWN_ACK_1 = bytes([0xA7])
KNOWN_ACK_2 = bytes([0xAA])
KNOWN_HEARTBEAT = bytes([0xF0, 0x64])


def build_channel_frame(channels: bytes) -> bytes:
    """512 channels x 3 bytes = 1536 bytes. See docs/DMX_PACKET_PROTOCOL.md
    §7.2 for the full field-by-field explanation of this encoding."""
    frame = bytearray(FRAME_MAX_CHANNEL * FRAME_BYTES_PER_CHANNEL)
    for i in range(FRAME_MAX_CHANNEL):
        value = channels[i] if i < len(channels) else 0
        if i < 128:
            base_code = 0xC0
        elif i < 256:
            base_code = 0xC2
        elif i < 384:
            base_code = 0xC4
        elif i < 511:
            base_code = 0xC6
        else:
            base_code = 0x86  # special-cased last channel, per the reference implementation
        offset = i * FRAME_BYTES_PER_CHANNEL
        frame[offset] = base_code | ((value >> 7) & 0x01)
        frame[offset + 1] = i & 0x7F
        frame[offset + 2] = value & 0x7F
    return bytes(frame)


def _describe_reply(data: bytes) -> str:
    if data == KNOWN_ACK_1:
        return "matches documented ack #1 (A7)"
    if data == KNOWN_ACK_2:
        return "matches documented ack #2 (AA)"
    if data == KNOWN_HEARTBEAT:
        return "matches documented 1s heartbeat (F0 64)"
    return "unrecognized reply — not in the documented A7/AA/F0-64 set, worth a closer look"


def probe(
    host: str,
    port: int,
    log: PacketLog,
    listen_time: float = 3.0,
    blink_hold: float = 0.6,
) -> dict:
    """Sends the hello handshake, listens for a reply, sends a blink-test
    channel frame (all channels full, then off), and keeps listening a
    little longer in case the device's heartbeat shows up."""
    result: dict = {"hello_sent": False, "replies": [], "frame_sent": False, "frame_error": None}

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(("0.0.0.0", 0))  # ephemeral local port — but unlike the app, we DO listen on it
    sock.settimeout(0.25)

    def listen_for(seconds: float) -> None:
        deadline = time.time() + seconds
        while time.time() < deadline:
            try:
                data, addr_info = sock.recvfrom(2048)
            except socket.timeout:
                continue
            except OSError:
                return
            addr = addr_info[0]
            desc = _describe_reply(data)
            result["replies"].append({"from": addr, "hex": data.hex(" ").upper(), "note": desc})
            log.log("freedmx", "rx", addr, port, data, summary=f"reply from device: {desc}")

    try:
        sock.sendto(HELLO, (host, port))
        log.log("freedmx", "tx", host, port, HELLO, summary="hello handshake (E5 39 60 00)")
        result["hello_sent"] = True

        listen_for(listen_time)

        on = bytes([255]) * 512
        off = bytes(512)

        for label, frame in (("ON", build_channel_frame(on)), ("OFF (after hold)", build_channel_frame(off))):
            if label.startswith("OFF"):
                time.sleep(blink_hold)
            for offset in range(0, len(frame), DATAGRAM_MAX_SIZE):
                chunk = frame[offset : offset + DATAGRAM_MAX_SIZE]
                sock.sendto(chunk, (host, port))
                log.log("freedmx", "tx", host, port, chunk, summary=f"channel-frame chunk {label} @byte{offset}")
        result["frame_sent"] = True

        # A last listen window in case the device's 1s heartbeat shows up
        # once it considers this a "connected" client.
        listen_for(min(listen_time, 2.0))

        sock.sendto(BYE, (host, port))
        log.log("freedmx", "tx", host, port, BYE, summary="bye (AC 00)")
    except OSError as e:
        result["frame_error"] = str(e)
        log.log("freedmx", "tx", host, port, b"", summary="send failed", ok=False, error=str(e))
    finally:
        sock.close()

    return result
