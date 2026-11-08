@echo off
echo Installing dependencies (websockets)...
pip install -r requirements.txt

echo.
echo Running DMX debug toolkit against 192.168.4.1 (freeDMX AP factory IP)...
echo   Art-Net probe targets port 6454 (fixed standard port)
echo   freeDMX-native probe targets port 10100 (device's factory General UDP-Port)
echo Edit this file, or pass your own flags, to target a different IP/port.
echo See dmx_debug_toolkit.py --help for every option.
echo.
python dmx_debug_toolkit.py --host 192.168.4.1

pause
