@echo off
REM Development setup script for Secure File Manager (Windows)

setlocal enabledelayedexpansion

echo 🔧 Setting up Secure File Manager...

REM Check for Node.js
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js version: %NODE_VERSION%

REM Check for Python
where python >nul 2>nul
if errorlevel 1 (
    echo ❌ Python is not installed
    exit /b 1
)

for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo ✅ Python version: %PYTHON_VERSION%

REM Install root dependencies
echo 📦 Installing root dependencies...
call npm install

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd frontend
call npm install
cd ..

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install
cd ..

REM Setup Python virtual environment
echo 🐍 Setting up Python environment...
cd worker
python -m venv venv
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
call venv\Scripts\deactivate.bat
cd ..

REM Copy environment file
if not exist .env (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please update .env with your configuration
)

echo.
echo ✅ Setup complete!
echo.
echo Next steps:
echo 1. Update .env with your configuration
echo 2. Run: docker-compose up -d  (to start database ^& message broker)
echo 3. Run: npm run dev            (to start frontend + backend)
echo 4. In another terminal: npm run worker:dev (to start Python worker)
echo.
echo Frontend:  http://localhost:5173
echo Backend:   http://localhost:3000
echo Worker:    http://localhost:5000
