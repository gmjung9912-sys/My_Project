@echo off
cd /d "%~dp0"
set PATH=%PATH%;C:\Program Files\nodejs

start "AI 스튜디오 개발 서버" cmd /k "npm run dev"
timeout /t 3 >nul
start "" http://localhost:5173/
