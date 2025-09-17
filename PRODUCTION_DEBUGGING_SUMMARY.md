# 🔧 Production Debugging Implementation - Complete Summary

## 🎯 Problem Analysis

The issue with the backend not finding locations in production is most likely due to **missing or incorrectly configured environment variables** in Heroku. Our debugging infrastructure has identified two critical dependencies:

1. **OpenCage Geocoding API Key** - Required for Phase 2 geocoding
2. **ML Service Connectivity** - Required for Phase 1 spaCy NER

## ✅ Debugging Infrastructure Implemented

### 1. **Debug Endpoints Created**

#### `/api/phylo/debug/config` (GET)
- **Purpose**: Check environment variable configuration
- **Shows**: API key status, service URLs, environment mode
- **Safe**: No sensitive data exposed

#### `/api/phylo/debug/services` (GET)
- **Purpose**: Test connectivity to external services
- **Tests**: ML Service health, NER endpoint, OpenCage API
- **Output**: Service status, response times, error details

#### `/api/phylo/debug/pipeline-test` (POST)
- **Purpose**: Test complete location extraction pipeline
- **Input**: `{"text": "your test text"}`
- **Output**: Full pipeline results with detailed metrics

### 2. **Enhanced Logging**
- Added comprehensive console logging throughout the pipeline
- Service status tracking and error reporting
- Pipeline method identification for debugging

### 3. **Production Configuration Files**

#### `HEROKU_DEBUG_GUIDE.md`
- Complete troubleshooting guide for production issues
- Step-by-step debugging process
- Common issues and solutions
- Required Heroku config vars

#### `.env.production.template`
- Template with all required production environment variables
- Comments explaining each variable's purpose
- Heroku CLI commands for easy setup

#### `scripts/setup-heroku-config.sh`
- Automated script to configure Heroku environment
- Sets all required config vars
- Tests configuration automatically
- Provides status feedback

## 🛠️ Required Heroku Configuration

### **Mandatory Config Vars:**
```bash
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-app.herokuapp.com
ML_SERVICE_HF_URL=https://acauanrr-phylo-ml-service.hf.space
OPENCAGE_API_KEY=your_actual_opencage_api_key
```

### **Quick Setup Commands:**
```bash
# Use the automated script
./scripts/setup-heroku-config.sh your-heroku-app-name

# Or set manually
heroku config:set NODE_ENV=production -a your-app
heroku config:set OPENCAGE_API_KEY=your_key -a your-app
heroku config:set CORS_ORIGIN=https://your-frontend.herokuapp.com -a your-app
heroku config:set ML_SERVICE_HF_URL=https://acauanrr-phylo-ml-service.hf.space -a your-app
```

## 🧪 Testing Production Configuration

### **1. Quick Health Check**
```bash
curl https://your-app.herokuapp.com/api/phylo/debug/config
```

**Expected for working config:**
```json
{
  "opencage_api_key_configured": true,
  "node_env": "production",
  "ml_service_hf_url": "https://acauanrr-phylo-ml-service.hf.space"
}
```

### **2. Service Connectivity Test**
```bash
curl https://your-app.herokuapp.com/api/phylo/debug/services
```

**Should show all services as "healthy"**

### **3. Complete Pipeline Test**
```bash
curl -X POST https://your-app.herokuapp.com/api/phylo/debug/pipeline-test \
  -H "Content-Type: application/json" \
  -d '{"text": "Test with New York and London"}'
```

**Expected result:**
```json
{
  "summary": {
    "extraction_method": "enhanced_ner_geocoding",
    "locations_found": 2,
    "has_location_data": true
  }
}
```

## 🔍 Troubleshooting Guide

### **Issue 1: OpenCage API Key Problems**
**Symptoms:**
- `opencage_api_key_configured: false`
- `extraction_method: "fallback_basic"`
- Mock coordinates instead of real geocoding

**Solutions:**
1. Get API key from https://opencagedata.com/ (free tier: 2,500 requests/day)
2. Set in Heroku: `heroku config:set OPENCAGE_API_KEY=your_key`
3. Restart app: `heroku restart`
4. Verify: Check debug/config endpoint

### **Issue 2: ML Service Connection Problems**
**Symptoms:**
- ML service shows "error" status in debug/services
- NER extraction fails
- Falls back to basic pattern matching

**Solutions:**
1. Check HuggingFace Space status: https://acauanrr-phylo-ml-service.hf.space/health
2. Verify URL in config: `ML_SERVICE_HF_URL=https://acauanrr-phylo-ml-service.hf.space`
3. HuggingFace Spaces may sleep - first request can be slow (30+ seconds)

### **Issue 3: CORS Configuration**
**Symptoms:**
- Frontend can't connect to backend
- Browser console CORS errors

**Solutions:**
1. Set exact frontend URL: `CORS_ORIGIN=https://your-frontend.herokuapp.com`
2. No trailing slash in URL
3. Restart after changes

## 📊 Expected Production Behavior

### **Successful Flow:**
1. **Phase 1**: Text → spaCy NER (HuggingFace) → Location entities
2. **Phase 2**: Location entities → OpenCage API → Geographic coordinates
3. **Phase 3**: Frontend displays highlighted countries + markers

### **Fallback Behavior:**
- **If ML Service fails**: Falls back to pattern matching + mock coordinates
- **If OpenCage fails**: Uses mock coordinates for known locations
- **System never fails completely**: Always returns location data

### **Debug Output Interpretation:**
```json
{
  "extraction_method": "enhanced_ner_geocoding",  // ✅ Full pipeline working
  "extraction_method": "fallback_basic",          // ⚠️ API issues detected
  "geocoding_service": {
    "configured": true,     // ✅ OpenCage API key valid
    "configured": false,    // ❌ API key missing/invalid
    "mock_fallback": true   // ⚠️ Using mock data
  }
}
```

## 🚀 Deployment Checklist

- [ ] **Get OpenCage API Key**: Register at https://opencagedata.com/
- [ ] **Set Heroku Config Vars**: Use script or manual commands
- [ ] **Verify ML Service**: Check HuggingFace Space is running
- [ ] **Test Debug Endpoints**: All should return successful responses
- [ ] **Check Frontend CORS**: Exact URL match required
- [ ] **Monitor First Requests**: HuggingFace may need warm-up time
- [ ] **Verify Complete Pipeline**: End-to-end location extraction working

## 📞 Support Information

**Debug Endpoints for Support:**
- Config: `/api/phylo/debug/config`
- Services: `/api/phylo/debug/services`
- Pipeline: `/api/phylo/debug/pipeline-test`

**Heroku Monitoring:**
- Logs: `heroku logs --tail -a your-app`
- Config: `heroku config -a your-app`
- Status: `heroku ps -a your-app`

**External Service Status:**
- OpenCage API: https://opencagedata.com/api/status
- HuggingFace Space: https://acauanrr-phylo-ml-service.hf.space/health

The debugging infrastructure provides complete visibility into the production environment and should quickly identify the root cause of any location extraction issues.