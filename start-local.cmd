@echo off
cd /d "%~dp0"
echo Smart BOQ local SQLite - http://127.0.0.1:5177/
echo Keep this window open while using the application.
call npm run dev
pause
