@echo off
echo Starting DMX Visualizer Backend...
start cmd /k "cd server && pip install -r requirements.txt && python server.py"

echo Starting DMX Visualizer Frontend...
start cmd /k "cd frontend && npm run dev"

echo Both servers are starting in new windows.
echo Once Vite is ready, open http://localhost:5173 in your browser.
