import asyncio
import json
import os
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import websockets

class DMXServer:
    def __init__(self):
        self.dmx_data = [0] * 512
        self.clients = set()

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
                length = (data[16] << 8) | data[17]
                universe_data = data[18:18 + length]
                for i, val in enumerate(universe_data):
                    if i < 512:
                        self.dmx_data[i] = val
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

    def datagram_received(self, data, addr):
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
            print(f"[{protocol}] Packet from {addr[0]}:{addr[1]}  {summary}")
            asyncio.create_task(self.dmx_server.broadcast_dmx())


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

    if getattr(sys, "frozen", False):
        serve_frontend()
        webbrowser.open("http://localhost:5173")

    print("-" * 48)
    await ws_server
    await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
