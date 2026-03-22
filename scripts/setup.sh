#!/bin/bash
# Development setup script for Secure File Manager

set -e

echo "🔧 Setting up Secure File Manager..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi

echo "✅ Python version: $(python3 --version)"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd frontend
npm install
cd ..

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
cd ..

# Setup Python virtual environment
echo "🐍 Setting up Python environment..."
cd worker
python3 -m venv venv
source venv/bin/activate 2>/dev/null || . venv/Scripts/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate
cd ..

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env with your configuration"
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env with your configuration"
echo "2. Run: docker-compose up -d  (to start database & message broker)"
echo "3. Run: npm run dev            (to start frontend + backend)"
echo "4. In another terminal: npm run worker:dev (to start Python worker)"
echo ""
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:3000"
echo "Worker:    http://localhost:5000"
