@echo off
REM Starts a local HTTP server and opens the game in the default browser
start "Server" cmd /k "python -m http.server 8000"
timeout /t 1 >nul
start "" "http://localhost:8000/pirate-game/index.html"
echo Server started at http://localhost:8000/pirate-game/index.html
pause
