import asyncio
import json
import os
import socket
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, SimpleHTTPRequestHandler, ThreadingHTTPServer

import websockets

HTTP_DMX_PORT = 8081  # separate from the WS port (8080) — pick whichever matches the app's transport setting


def get_local_ip() -> str:
    """Best-effort LAN IP — used to fill the ArtPollReply's own address field.
    The UDP "connect" here never sends a packet; it just asks the OS which
    local interface/address would be used to route to that destination.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


def build_artpoll_reply(local_ip: str) -> bytes:
    """Minimal ArtPollReply (OpCode 0x2100) so the app's network-scan feature
    has a real Art-Net node to discover during development."""
    packet = bytearray(239)
    packet[0:8] = b'Art-Net\x00'
    packet[8] = 0x00
    packet[9] = 0x21  # OpCode 0x2100, little-endian
    ip_bytes = bytes(int(x) for x in local_ip.split('.'))
    packet[10:14] = ip_bytes
    packet[14] = 0x36  # Port 6454, little-endian
    packet[15] = 0x19
    packet[20] = 0x00  # OemHi
    packet[21] = 0xff  # OemLo — 0x00FF is unregistered/prototype, avoids claiming a real vendor
    short_name = b'DMX Visualizer'
    packet[26:26 + len(short_name)] = short_name
    long_name = b'Mobile DMX Improvisator - Desktop Visualizer'
    packet[44:44 + len(long_name)] = long_name
    packet[172] = 0x00  # NumPortsHi
    packet[173] = 0x01  # NumPortsLo
    packet[174] = 0x80  # PortTypes[0]: output-capable, DMX512
    packet[200] = 0x00  # Style: StNode
    packet[207:211] = ip_bytes  # BindIp
    packet[211] = 0x01  # BindIndex
    return bytes(packet)

class DMXServer:
    def __init__(self):
        self.dmx_data = [0] * 512
        self.clients = set()
        self.last_sequence = None

    async def register(self, websocket):
        self.clients.add(websocket)
        addr = websocket.remote_address
        print(f"[WebSocket] Client connected: {addr[0]}:{addr[1]}")
        try:
            # Send current state on connect
            await websocket.send(json.dumps({"type": "DMX_DATA", "data": self.dmx_data}))
            async for raw in websocket:
                try:
                    msg = json.loads(raw)
                except json.JSONDecodeError:
                    continue

                if msg.get("type") == "SEND_DMX":
                    data = msg.get("data", [])
                    universe = msg.get("universe", 0)
                    if isinstance(data, list) and len(data) > 0:
                        for i, val in enumerate(data[:512]):
                            self.dmx_data[i] = int(val)
                        non_zero = [
                            f"ch{i+1}={v}"
                            for i, v in enumerate(data[:512])
                            if v > 0
                        ][:10]
                        summary = "  ".join(non_zero) if non_zero else "(all channels zero)"
                        print(f"[WebSocket] DMX universe={universe}  {summary}")
                        await self.broadcast_dmx()

        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            self.clients.discard(websocket)
            print(f"[WebSocket] Client disconnected: {addr[0]}:{addr[1]}")

    async def broadcast_dmx(self):
        if not self.clients:
            return
        message = json.dumps({"type": "DMX_DATA", "data": self.dmx_data})
        await asyncio.gather(
            *[client.send(message) for client in self.clients],
            return_exceptions=True,
        )

    def handle_artnet_packet(self, data):
        if len(data) > 18 and data[0:8] == b'Art-Net\x00':
            opcode = data[8] | (data[9] << 8)
            if opcode == 0x5000:  # ArtDMX
                sequence = data[12]
                length = (data[16] << 8) | data[17]
                universe_data = data[18:18 + length]
                for i, val in enumerate(universe_data):
                    if i < 512:
                        self.dmx_data[i] = val
                self.last_sequence = sequence
                return True
        return False

    def handle_sacn_packet(self, data):
        acn_id = b'\x41\x53\x43\x2d\x45\x31\x2e\x31\x37\x00\x00\x00'
        if len(data) > 125 and data[16:28] == acn_id:
            universe_data = data[126:126 + 512]
            for i, val in enumerate(universe_data):
                if i < 512:
                    self.dmx_data[i] = val
            return True
        return False


class UDPServerProtocol(asyncio.DatagramProtocol):
    def __init__(self, dmx_server):
        self.dmx_server = dmx_server
        self.loop = asyncio.get_running_loop()
        self.transport = None
        self.local_ip = get_local_ip()

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, addr):
        if len(data) >= 10 and data[0:8] == b'Art-Net\x00':
            opcode = data[8] | (data[9] << 8)
            if opcode == 0x2000:  # ArtPoll — reply so the app's network scan finds us
                reply = build_artpoll_reply(self.local_ip)
                if self.transport:
                    # Unicast straight back to the sender's own bound port (the
                    # app's discovery socket is bound to 6454, matching `addr`
                    # here since it sent the poll from that same socket).
                    self.transport.sendto(reply, addr)
                print(f"[Art-Net] ArtPoll from {addr[0]}:{addr[1]} — replied")
                return

        updated = False
        protocol = ""
        if len(data) > 8 and data[0:8] == b'Art-Net\x00':
            updated = self.dmx_server.handle_artnet_packet(data)
            if updated:
                protocol = "Art-Net"
        elif len(data) > 125:
            updated = self.dmx_server.handle_sacn_packet(data)
            if updated:
                protocol = "sACN"

        if updated:
            non_zero = [
                f"ch{i+1}={v}"
                for i, v in enumerate(self.dmx_server.dmx_data[:512])
                if v > 0
            ][:10]
            summary = "  ".join(non_zero) if non_zero else "(all zero)"
            seq = self.dmx_server.last_sequence
            seq_str = f"seq={seq}  " if seq is not None else ""
            print(f"[{protocol}] Packet from {addr[0]}:{addr[1]}  {seq_str}{summary}")
            asyncio.create_task(self.dmx_server.broadcast_dmx())


def serve_http_dmx(dmx_server: 'DMXServer', loop: asyncio.AbstractEventLoop, port: int = HTTP_DMX_PORT):
    """HTTP counterpart to the WebSocket SEND_DMX message, for the app's
    'HTTP' web transport option. POST /dmx with the same JSON body the
    WebSocket protocol uses: {"type": "SEND_DMX", "universe": N, "data": [...]}.
    Runs in its own thread (stdlib http.server), so DMX-state mutation is
    handed back to the asyncio loop via run_coroutine_threadsafe.
    """
    class DMXHTTPHandler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def _cors(self):
            self.send_header('Access-Control-Allow-Origin', '*')

        def do_OPTIONS(self):
            self.send_response(204)
            self._cors()
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()

        def do_POST(self):
            if self.path != '/dmx':
                self.send_response(404)
                self._cors()
                self.end_headers()
                return
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length) if length else b''
            try:
                msg = json.loads(body) if body else {}
            except json.JSONDecodeError:
                self.send_response(400)
                self._cors()
                self.end_headers()
                return

            if msg.get('type') == 'SEND_DMX':
                data = msg.get('data', [])
                if isinstance(data, list) and len(data) > 0:
                    for i, val in enumerate(data[:512]):
                        dmx_server.dmx_data[i] = int(val)
                    asyncio.run_coroutine_threadsafe(dmx_server.broadcast_dmx(), loop)

            self.send_response(204)
            self._cors()
            self.end_headers()

    httpd = ThreadingHTTPServer(('0.0.0.0', port), DMXHTTPHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print(f"HTTP DMX endpoint on          http://0.0.0.0:{port}/dmx")


def serve_frontend(port=5173):
    # Only used in the packaged .exe, which bundles the built frontend
    # alongside the interpreter (see the PyInstaller --add-data step in CI).
    # The normal dev workflow (start-visualizer.bat) runs Vite separately.
    dist_dir = os.path.join(sys._MEIPASS, "frontend", "dist")

    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=dist_dir, **kwargs)

        def log_message(self, format, *args):
            pass

    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    print(f"Web UI on                     http://localhost:{port}")


async def main():
    dmx_server = DMXServer()

    ws_server = websockets.serve(dmx_server.register, "0.0.0.0", 8080)
    loop = asyncio.get_running_loop()

    try:
        await loop.create_datagram_endpoint(
            lambda: UDPServerProtocol(dmx_server),
            local_addr=('0.0.0.0', 6454),
        )
        print("Listening for Art-Net on UDP  0.0.0.0:6454")
    except Exception as e:
        print(f"Failed to bind Art-Net port: {e}")

    try:
        await loop.create_datagram_endpoint(
            lambda: UDPServerProtocol(dmx_server),
            local_addr=('0.0.0.0', 5568),
        )
        print("Listening for sACN on UDP     0.0.0.0:5568")
    except Exception as e:
        print(f"Failed to bind sACN port: {e}")

    print("WebSocket server on           ws://0.0.0.0:8080")

    serve_http_dmx(dmx_server, loop)

    if getattr(sys, "frozen", False):
        serve_frontend()
        webbrowser.open("http://localhost:5173")

    print("-" * 48)
    await ws_server
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
