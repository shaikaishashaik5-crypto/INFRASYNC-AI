@echo off
REM INFRASYNC AI - one-click launcher for Windows
cd /d "%~dp0"
where py >nul 2>nul && (set PY=py) || (where python >nul 2>nul && (set PY=python) || (
  echo Python is not installed. Install it from https://www.python.org/downloads/ and tick "Add python.exe to PATH", then run this file again.
  pause & exit /b 1))
if not exist .venv (
  echo Setting up for the first time, please wait...
  %PY% -m venv .venv || (echo Could not create virtual environment & pause & exit /b 1)
)
call .venv\Scripts\activate.bat
pip install -q --disable-pip-version-check -r requirements.txt || (echo Install failed - check your internet connection & pause & exit /b 1)
echo.
echo   INFRASYNC AI is starting
echo   Open in your browser: http://localhost:8000
echo   (Close this window to stop the app)
echo.
start "" http://localhost:8000
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
