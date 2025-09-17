import express from 'express';
import axios from 'axios';
import mlService from '../services/mlService.js';
import webSearchService from '../services/webSearchService.js';

const router = express.Router();


/**
 * POST /api/phylo/generate-tree
 * Generate phylogenetic tree from texts
 */
router.post('/generate-tree', async (req, res) => {
  try {
    const { texts, labels } = req.body;
    console.log('🎯 Route handler received request:', { texts, labels });

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: texts array is required'
      });
    }

    // Call ML service
    console.log('🎯 Calling mlService.generateTree...');
    const result = await mlService.generateTree(texts, labels);
    console.log('🎯 ML service returned:', result);

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Generate tree error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/phylo/search
 * Search for node information using web search and ML service with geolocation data
 */
router.post('/search', async (req, res) => {
  try {
    const { query, node_name, node_type } = req.body;
    const searchQuery = query || node_name;

    if (!searchQuery) {
      return res.status(400).json({
        success: false,
        error: 'Query or node_name is required'
      });
    }

    console.log('🔍 Search request for:', searchQuery, 'type:', node_type);
    let searchResults;

    // Try to use ML service for search with geolocation data
    try {
      const mlServiceUrl = process.env.ML_SERVICE_LOCAL_URL || process.env.ML_SERVICE_URL || 'https://acauanrr-phylo-ml-service.hf.space';
      console.log('📡 Calling ML service at:', mlServiceUrl);

      const mlResponse = await axios.post(
        `${mlServiceUrl}/api/search-node`,  // Direct Flask API endpoint
        {
          node_name: searchQuery,
          node_type: node_type || 'general'
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // 30 second timeout for web scraping and geocoding
        }
      );

      console.log('📋 ML service response status:', mlResponse.status);
      console.log('📋 ML service response data keys:', Object.keys(mlResponse.data || {}));

      if (mlResponse.data && mlResponse.data.success && mlResponse.data.data) {
        const mlResult = mlResponse.data.data;
        console.log('📍 Locations found:', mlResult.locations?.length || 0);
        console.log('🗺️ Geo data points:', mlResult.geo_data?.length || 0);

        // Use ML service result with geolocation data
        searchResults = {
          node_name: searchQuery,
          title: mlResult.title || searchQuery,
          summary: mlResult.summary || '',
          image_url: mlResult.image_url || null,
          source_url: mlResult.source_url || '',
          publication_date: new Date().toISOString().split('T')[0],
          wikipedia: mlResult.wikipedia || {},
          web_results: mlResult.web_results || [],
          enhanced_results: mlResult.enhanced_results || mlResult.web_results || [],
          // Include geolocation data from ML service
          locations: mlResult.locations || [],
          geo_data: mlResult.geo_data || [],
          // Location metadata
          has_location_data: mlResult.has_location_data || false,
          total_locations: mlResult.total_locations || 0,
          total_coordinates: mlResult.total_coordinates || 0,
          category: mlResult.category || 'General',
          headline: mlResult.headline || mlResult.title || searchQuery
        };
        console.log('✅ Using ML service search results with', searchResults.locations.length, 'locations');
      }
    } catch (mlError) {
      console.log('❌ ML service search failed, using fallback web search:', mlError.message);
    }

    // Fallback to local web search service if ML service didn't work
    if (!searchResults) {
      searchResults = await webSearchService.search(searchQuery);
      console.log('📋 Using local web search service fallback');

      // Ensure location fields exist even in fallback
      searchResults.locations = searchResults.locations || [];
      searchResults.geo_data = searchResults.geo_data || [];
      searchResults.has_location_data = false;
      searchResults.total_locations = 0;
      searchResults.total_coordinates = 0;
    }

    // Add node type if provided
    if (node_type) {
      searchResults.node_type = node_type;
    }

    // Add location summary for frontend
    searchResults.location_summary = {
      has_locations: searchResults.has_location_data || searchResults.locations.length > 0,
      location_count: searchResults.total_locations || searchResults.locations.length,
      coordinate_count: searchResults.total_coordinates || searchResults.geo_data.length,
      sample_locations: searchResults.locations.slice(0, 3) // First 3 for preview
    };

    console.log('🎯 Final response - locations:', searchResults.location_summary.location_count, 'coordinates:', searchResults.location_summary.coordinate_count);

    res.json({
      success: true,
      data: searchResults,
      query: searchQuery,
      geolocation_enabled: true
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/phylo/health
 * Check ML service health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await mlService.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

export default router;