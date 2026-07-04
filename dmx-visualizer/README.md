# Desktop DMX Visualizer

This is a standalone visualizer designed to run on your computer to test the Mobile DMX Improvisator app. It features a Python backend that receives raw DMX packets via UDP and a React frontend with both 2D and 3D visualizers.

## Prerequisites

- **Python 3** (must be installed and added to your PATH)
- **Node.js** (for running the React frontend)

## How to Start

The easiest way to start both the backend server and the web interface is to use the provided batch script:

1. Double-click the **`start-visualizer.bat`** file located in this directory.
2. Two terminal windows will appear automatically:
   - One will start the Python DMX server (listening on UDP 6454 for Art-Net and 5568 for sACN).
   - The other will start the Vite React development server.
3. Open your browser and go to `http://localhost:5173`.

### Connecting your Mobile App
1. Open the Mobile DMX app on your phone.
2. Go to **Settings**.
3. Change the **Receiver IP** to the IP address of your computer on your local network (e.g., `192.168.1.50`).
4. You can use either port `6454` (Art-Net) or `5568` (sACN). The server listens to both.
5. Tap "Test Connection" or start changing colors in the app. The visualizer will update instantly!

## Manual Start

If you prefer to start them manually without the script:

**Start the Server:**
```bash
cd server
pip install -r requirements.txt
python server.py
```

**Start the Frontend:**
```bash
cd frontend
npm run dev
```
