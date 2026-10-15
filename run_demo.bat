@echo off
rem Double-click to start the Helios demo (Windows). Needs the one-time setup in README.md.
cd /d "%~dp0"
".venv\Scripts\python.exe" run_demo.py %*
pause
