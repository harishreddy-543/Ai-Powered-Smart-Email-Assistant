@echo off
echo =========================================
echo Starting Neural Inbox AI Email Assistant
echo =========================================

echo.
echo [1] Starting Backend Server...
cd backend
start "Neural Inbox - Backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn app.main:app --reload"
cd ..

echo.
echo [2] Starting Frontend Server...
cd frontend
start "Neural Inbox - Frontend" cmd /k "npm run dev"
cd ..

echo.
echo =========================================
echo Both servers are starting in separate windows.
echo CRITICAL: Do NOT close those new black windows!
echo Keep them open while using the app.
echo =========================================
