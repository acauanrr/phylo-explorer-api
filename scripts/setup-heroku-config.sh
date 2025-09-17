#!/bin/bash

# Heroku Configuration Setup Script
# This script helps set up all required environment variables for production deployment

set -e

echo "🚀 Heroku Configuration Setup for Phylo Explorer API"
echo "=================================================="

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI is not installed. Please install it first:"
    echo "   https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Get app name
if [ -z "$1" ]; then
    echo "📝 Usage: $0 <heroku-app-name> [frontend-app-name] [opencage-api-key]"
    echo "   Example: $0 my-phylo-api my-phylo-frontend abc123def456"
    exit 1
fi

HEROKU_APP_NAME=$1
FRONTEND_APP_NAME=${2:-"phylo-explorer-front"}
OPENCAGE_API_KEY=${3:-""}

echo "🔧 Setting up configuration for app: $HEROKU_APP_NAME"

# Set basic environment variables
echo "📋 Setting basic environment variables..."
heroku config:set NODE_ENV=production -a $HEROKU_APP_NAME
heroku config:set PORT=6001 -a $HEROKU_APP_NAME

# Set CORS origin
CORS_ORIGIN="https://${FRONTEND_APP_NAME}.herokuapp.com"
echo "🌐 Setting CORS origin to: $CORS_ORIGIN"
heroku config:set CORS_ORIGIN=$CORS_ORIGIN -a $HEROKU_APP_NAME

# Set ML Service URL
ML_SERVICE_URL="https://acauanrr-phylo-ml-service.hf.space"
echo "🤖 Setting ML Service URL to: $ML_SERVICE_URL"
heroku config:set ML_SERVICE_HF_URL=$ML_SERVICE_URL -a $HEROKU_APP_NAME

# Set OpenCage API Key
if [ -n "$OPENCAGE_API_KEY" ]; then
    echo "🗺️ Setting OpenCage API Key..."
    heroku config:set OPENCAGE_API_KEY=$OPENCAGE_API_KEY -a $HEROKU_APP_NAME
else
    echo "⚠️ OpenCage API Key not provided. You'll need to set it manually:"
    echo "   heroku config:set OPENCAGE_API_KEY=your_key_here -a $HEROKU_APP_NAME"
    echo "   Get your key at: https://opencagedata.com/"
fi

echo ""
echo "✅ Configuration completed! Current config vars:"
heroku config -a $HEROKU_APP_NAME

echo ""
echo "🔄 Restarting application..."
heroku restart -a $HEROKU_APP_NAME

echo ""
echo "🧪 Testing configuration..."
HEROKU_URL="https://${HEROKU_APP_NAME}.herokuapp.com"

echo "   Waiting for app to start..."
sleep 10

echo "   Testing debug config endpoint..."
curl -s "$HEROKU_URL/api/phylo/debug/config" > /tmp/heroku_config_test.json

if grep -q '"success":true' /tmp/heroku_config_test.json; then
    echo "✅ Configuration test passed!"
    echo "📊 Environment status:"
    cat /tmp/heroku_config_test.json | grep -o '"opencage_api_key_configured":[^,]*' | sed 's/"opencage_api_key_configured":/   OpenCage API Key: /'
    cat /tmp/heroku_config_test.json | grep -o '"node_env":"[^"]*"' | sed 's/"node_env":"/   Environment: /' | sed 's/"$//'
else
    echo "❌ Configuration test failed. Check the logs:"
    echo "   heroku logs --tail -a $HEROKU_APP_NAME"
fi

echo ""
echo "🔗 Important URLs:"
echo "   App: $HEROKU_URL"
echo "   Health: $HEROKU_URL/api/phylo/health"
echo "   Debug Config: $HEROKU_URL/api/phylo/debug/config"
echo "   Debug Services: $HEROKU_URL/api/phylo/debug/services"

echo ""
echo "📋 Next steps:"
echo "1. Test all debug endpoints to ensure services are working"
echo "2. Deploy your frontend app with API_URL=$HEROKU_URL"
echo "3. Test the complete pipeline end-to-end"

# Cleanup
rm -f /tmp/heroku_config_test.json