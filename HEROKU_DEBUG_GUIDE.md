# 🔧 Heroku Production Debugging Guide

## Quick Diagnostics

### 1. Check Environment Configuration
```bash
curl https://your-heroku-app.herokuapp.com/api/phylo/debug/config
```

**Expected Response:**
```json
{
  "success": true,
  "config": {
    "node_env": "production",
    "opencage_api_key_configured": true,
    "ml_service_hf_url": "https://acauanrr-phylo-ml-service.hf.space",
    "geocoding_service_status": {
      "configured": true,
      "provider": "OpenCage"
    }
  }
}
```

### 2. Test External Service Connectivity
```bash
curl https://your-heroku-app.herokuapp.com/api/phylo/debug/services
```

**This will test:**
- ML Service health (spaCy NER)
- ML Service location extraction endpoint
- OpenCage Geocoding API connectivity

### 3. Test Complete Pipeline
```bash
curl -X POST https://your-heroku-app.herokuapp.com/api/phylo/debug/pipeline-test \
  -H "Content-Type: application/json" \
  -d '{"text": "Test with New York and London"}'
```

## Required Heroku Config Vars

### Mandatory Variables
```bash
# Production environment
NODE_ENV=production

# CORS for frontend
CORS_ORIGIN=https://your-frontend-app.herokuapp.com

# ML Service URL (HuggingFace Space)
ML_SERVICE_HF_URL=https://acauanrr-phylo-ml-service.hf.space

# OpenCage Geocoding API Key (GET YOURS AT: https://opencagedata.com/)
OPENCAGE_API_KEY=your_actual_api_key_here
```

### Setting Config Vars in Heroku

#### Via Heroku Dashboard:
1. Go to your app dashboard
2. Click "Settings" tab
3. Click "Reveal Config Vars"
4. Add each variable individually

#### Via Heroku CLI:
```bash
heroku config:set NODE_ENV=production -a your-app-name
heroku config:set CORS_ORIGIN=https://your-frontend-app.herokuapp.com -a your-app-name
heroku config:set ML_SERVICE_HF_URL=https://acauanrr-phylo-ml-service.hf.space -a your-app-name
heroku config:set OPENCAGE_API_KEY=your_actual_api_key_here -a your-app-name
```

## Common Issues & Solutions

### Issue 1: OpenCage API Key Not Working
**Symptoms:**
- `opencage_api_key_configured: false` in debug/config
- Geocoding falls back to mock data
- Only basic location coordinates available

**Solution:**
1. Get your API key from https://opencagedata.com/
2. Set the config var exactly: `heroku config:set OPENCAGE_API_KEY=your_key_here`
3. Restart the app: `heroku restart`

### Issue 2: ML Service Connection Failed
**Symptoms:**
- `ml_service` status shows "error" in debug/services
- `extraction_method: "fallback_basic"` instead of "enhanced_ner_geocoding"

**Solution:**
1. Verify HuggingFace Space is running: https://acauanrr-phylo-ml-service.hf.space/health
2. Check the URL is correct in config vars
3. HuggingFace Spaces may go to sleep - the first request might be slow

### Issue 3: CORS Errors in Frontend
**Symptoms:**
- Frontend can't connect to backend API
- Browser console shows CORS errors

**Solution:**
1. Set correct CORS_ORIGIN: `heroku config:set CORS_ORIGIN=https://your-frontend-app.herokuapp.com`
2. Make sure frontend is using correct API URL in environment variables

### Issue 4: Environment Variables Not Loading
**Symptoms:**
- Config shows `null` or `undefined` for expected values

**Solution:**
1. Check all config vars are set: `heroku config -a your-app-name`
2. Restart app after setting variables: `heroku restart -a your-app-name`
3. Check for typos in variable names (case-sensitive)

## Production Monitoring Commands

### Check Application Logs
```bash
heroku logs --tail -a your-app-name
```

### View All Config Variables
```bash
heroku config -a your-app-name
```

### Restart Application
```bash
heroku restart -a your-app-name
```

### Check Application Status
```bash
heroku ps -a your-app-name
```

## Expected Production Behavior

### Successful Pipeline Flow:
1. **Phase 1**: Text → spaCy NER → Location entities extracted
2. **Phase 2**: Location entities → OpenCage API → Geographic coordinates
3. **Phase 3**: Frontend displays highlighted countries + location markers

### Fallback Behavior:
- If ML Service fails → Falls back to basic pattern matching
- If OpenCage API fails → Falls back to mock coordinates
- System always returns location data (never complete failure)

### Debug Endpoint URLs:
- Config: `/api/phylo/debug/config`
- Services: `/api/phylo/debug/services`
- Pipeline Test: `/api/phylo/debug/pipeline-test` (POST)

## Troubleshooting Checklist

- [ ] All required config vars are set in Heroku
- [ ] OpenCage API key is valid and has quota remaining
- [ ] ML Service (HuggingFace Space) is accessible
- [ ] CORS origin matches your frontend URL exactly
- [ ] Application has been restarted after config changes
- [ ] Debug endpoints return successful responses
- [ ] Production logs don't show authentication errors

## Getting Help

If issues persist:
1. Run all debug endpoints and save the responses
2. Check Heroku logs for specific error messages
3. Verify external service status (OpenCage, HuggingFace)
4. Compare local vs production debug responses