@echo off
cd /d "%~dp0"
if not exist .env (
  echo Missing .env file. Copy .env.example to .env and set JWT_SECRET first.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies...
  npm install
)
npm start
pause
