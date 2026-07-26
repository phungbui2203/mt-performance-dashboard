@echo off
cd /d "%~dp0"
echo Starting MT Dashboard at http://localhost:8080
start /b python -m http.server 8080
timeout /t 2 /nobreak >nul
start http://localhost:8080
