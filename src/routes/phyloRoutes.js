import express from 'express';
import axios from 'axios';
import mlService from '../services/mlService.js';
import webSearchService from '../services/webSearchService.js';

const router = express.Router();

/**
 * Extract basic location data from search query and results (fallback)
 */
async function extractBasicLocationData(query, searchResults) {
  const locations = [];
  const geo_data = [];

  try {
    // Common city/country patterns
    const locationPatterns = [
      /\b(New York|NYC)\b/gi,
      /\b(Los Angeles|LA)\b/gi,
      /\b(Chicago)\b/gi,
      /\b(London)\b/gi,
      /\b(Paris)\b/gi,
      /\b(Tokyo)\b/gi,
      /\b(Berlin)\b/gi,
      /\b(Washington|DC)\b/gi,
      /\b(Boston)\b/gi,
      /\b(San Francisco)\b/gi
    ];

    // Predefined coordinates for common locations
    const locationCoords = {
      'New York': { lat: 40.7127281, lon: -74.0060152, country: 'United States' },
      'NYC': { lat: 40.7127281, lon: -74.0060152, country: 'United States' },
      'Los Angeles': { lat: 34.0522265, lon: -118.2436596, country: 'United States' },
      'LA': { lat: 34.0522265, lon: -118.2436596, country: 'United States' },
      'Chicago': { lat: 41.8755616, lon: -87.6244212, country: 'United States' },
      'London': { lat: 51.5073219, lon: -0.1276474, country: 'United Kingdom' },
      'Paris': { lat: 48.8566969, lon: 2.3514616, country: 'France' },
      'Tokyo': { lat: 35.6828387, lon: 139.7594549, country: 'Japan' },
      'Berlin': { lat: 52.5170365, lon: 13.3888599, country: 'Germany' },
      'Washington': { lat: 38.8950368, lon: -77.0365427, country: 'United States' },
      'DC': { lat: 38.8950368, lon: -77.0365427, country: 'United States' },
      'Boston': { lat: 42.3554334, lon: -71.060511, country: 'United States' },
      'San Francisco': { lat: 37.7790262, lon: -122.4199061, country: 'United States' }
    };

    const foundLocations = new Set();

    // Check query for locations
    for (const pattern of locationPatterns) {
      const matches = query.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const normalizedMatch = match.trim();
          if (locationCoords[normalizedMatch] && !foundLocations.has(normalizedMatch)) {
            foundLocations.add(normalizedMatch);

            locations.push({
              name: normalizedMatch,
              type: 'city',
              confidence: 0.8
            });

            geo_data.push({
              name: normalizedMatch,
              display_name: `${normalizedMatch}, ${locationCoords[normalizedMatch].country}`,
              lat: locationCoords[normalizedMatch].lat,
              lon: locationCoords[normalizedMatch].lon,
              country: locationCoords[normalizedMatch].country,
              type: 'administrative',
              importance: 0.8
            });
          }
        });
      }
    }

    return {
      locations: Array.from(locations),
      geo_data: Array.from(geo_data),
      has_location_data: locations.length > 0,
      total_locations: locations.length,
      total_coordinates: geo_data.length
    };

  } catch (error) {
    console.error('Location extraction error:', error);
    return {
      locations: [],
      geo_data: [],
      has_location_data: false,
      total_locations: 0,
      total_coordinates: 0
    };
  }
}


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

      // Use different endpoints and data formats based on service type
      const isLocal = mlServiceUrl.includes('localhost') || mlServiceUrl.includes('127.0.0.1');
      const endpoint = isLocal ? '/api/search' : '/api/search-node';
      const requestData = isLocal
        ? {
            query: searchQuery,
            node_name: searchQuery,
            node_type: node_type || 'general'
          }
        : {
            data: [
              {
                node_name: searchQuery,
                node_type: node_type || 'general'
              }
            ]
          };

      console.log('📡 Using endpoint:', endpoint, 'isLocal:', isLocal);

      const mlResponse = await axios.post(
        `${mlServiceUrl}${endpoint}`,
        requestData,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000 // 30 second timeout for web scraping and geocoding
        }
      );

      console.log('📋 ML service response status:', mlResponse.status);
      console.log('📋 ML service response data keys:', Object.keys(mlResponse.data || {}));

      // Handle different response formats
      let mlResult;
      if (isLocal) {
        // Local service returns data directly
        if (mlResponse.data && mlResponse.data.status === 'success') {
          mlResult = mlResponse.data;
        }
      } else {
        // HuggingFace service returns nested structure
        if (mlResponse.data && mlResponse.data.success && mlResponse.data.data) {
          mlResult = mlResponse.data.data;
        }
      }

      if (mlResult) {
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

      // Try to extract location data from the search query and results
      const locationData = await extractBasicLocationData(searchQuery, searchResults);

      // Add location data to results
      searchResults.locations = locationData.locations;
      searchResults.geo_data = locationData.geo_data;
      searchResults.has_location_data = locationData.has_location_data;
      searchResults.total_locations = locationData.total_locations;
      searchResults.total_coordinates = locationData.total_coordinates;

      console.log('📍 Fallback location extraction found:', locationData.total_locations, 'locations');
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