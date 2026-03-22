#!/bin/bash
# Start development environment with all services

echo "🚀 Starting Secure File Manager Development Environment..."

# Start Docker services in background
echo "🐳 Starting Docker services (MongoDB, RabbitMQ, Redis)..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check if services are running
if ! docker ps | grep -q sfm-mongodb; then
    echo "⚠️  MongoDB container is not running"
fi

if ! docker ps | grep -q sfm-rabbitmq; then
    echo "⚠️  RabbitMQ container is not running"
fi

echo ""
echo "✅ Services started!"
echo ""
echo "In separate terminals, run:"
echo "1. npm run dev           # Frontend (5173) + Backend (3000)"
echo "2. npm run worker:dev    # Python Worker (5000)"
echo ""
echo "Services URLs:"
echo "- Frontend:       http://localhost:5173"
echo "- Backend API:    http://localhost:3000"
echo "- Worker API:     http://localhost:5000"
echo "- MongoDB:        mongodb://localhost:27017"
echo "- RabbitMQ Admin: http://localhost:15672 (guest/guest)"
echo "- Redis:          redis://localhost:6379"
echo ""
echo "To stop all services: docker-compose down"
