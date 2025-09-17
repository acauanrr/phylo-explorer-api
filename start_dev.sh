#!/bin/bash

# Script para iniciar o Backend API em modo desenvolvimento
echo "🚀 Starting Phylo Explorer Backend API in Development Mode"
echo "==========================================================="

# Verificar se node_modules existe
if [ ! -d "./node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Definir variáveis de ambiente para desenvolvimento
export NODE_ENV=development
export PORT=6001
export CORS_ORIGIN=http://localhost:3000
export ML_SERVICE_LOCAL_URL=http://localhost:5000
export ML_SERVICE_HF_URL=https://acauanrr-phylo-ml-service.hf.space

echo "🔧 Configuration:"
echo "   NODE_ENV: $NODE_ENV"
echo "   PORT: $PORT"
echo "   CORS_ORIGIN: $CORS_ORIGIN"
echo "   ML_SERVICE_LOCAL_URL: $ML_SERVICE_LOCAL_URL"
echo "   ML_SERVICE_HF_URL: $ML_SERVICE_HF_URL"
echo "==========================================================="
echo "🌟 Backend API will be available at: http://localhost:$PORT"
echo "🔗 Will connect to LOCAL ML Service at: $ML_SERVICE_LOCAL_URL"
echo "==========================================================="

# Iniciar o servidor
npm run dev