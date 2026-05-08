#!/bin/bash

# FaceGuard Deployment Quick Start Script

set -e

echo "🚀 FaceGuard Deployment Setup"
echo "=============================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✓ .env created. Please edit with your Supabase credentials:"
    echo "  - SUPABASE_URL"
    echo "  - SUPABASE_SERVICE_KEY"
    echo "  - SUPABASE_ANON_KEY"
    echo ""
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi

echo "✓ Docker found"
echo ""

# Build images
echo "🔨 Building Docker images..."
docker-compose build

echo ""
echo "✅ Deployment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env with your Supabase credentials"
echo "2. Run: docker-compose up"
echo ""
echo "Or for production deployment, see DEPLOYMENT.md"
