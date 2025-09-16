import express from 'express';
import axios from 'axios';
import mlService from '../services/mlService.js';
import webSearchService from '../services/webSearchService.js';

const router = express.Router();

// Handle OPTIONS for all routes (CORS preflight)
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

/**
 * POST /api/phylo/generate-tree
 * Generate phylogenetic tree from texts
 */
router.post('/generate-tree', async (req, res) => {
  try {
    const { texts, labels } = req.body;

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input: texts array is required'
      });
    }

    // Call ML service
    const result = await mlService.generateTree(texts, labels);

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
 * Search for node information using web search and optionally ML service
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

    let searchResults;

    // Try to use ML service's search-node endpoint if available
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'https://acauanrr-phylo-ml-service.hf.space';
      const mlResponse = await axios.post(
        `${mlServiceUrl}/api/search-node`,
        {
          node_name: searchQuery,
          node_type: node_type || 'general'
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 // 10 second timeout
        }
      );

      if (mlResponse.data && mlResponse.data.success && mlResponse.data.data) {
        searchResults = mlResponse.data.data;
        console.log('Using ML service search results');
      }
    } catch (mlError) {
      console.log('ML service search not available, using fallback web search:', mlError.message);
    }

    // Fallback to local web search service if ML service didn't work
    if (!searchResults) {
      searchResults = await webSearchService.search(searchQuery);
      console.log('Using local web search service');
    }

    // Add node type if provided
    if (node_type) {
      searchResults.node_type = node_type;
    }

    res.json({
      success: true,
      data: searchResults,
      query: searchQuery
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