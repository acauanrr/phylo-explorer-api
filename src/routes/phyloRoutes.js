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

    // Try to use HF Space Gradio endpoint for search
    try {
      const mlServiceUrl = process.env.ML_SERVICE_URL || 'https://acauanrr-phylo-ml-service.hf.space';
      const mlResponse = await axios.post(
        `${mlServiceUrl}/api/search_node`,  // Gradio endpoint
        {
          data: [searchQuery]  // Gradio format: array of inputs
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000 // 15 second timeout for web scraping
        }
      );

      if (mlResponse.data && mlResponse.data.data && mlResponse.data.data[0]) {
        // Parse the JSON response from Gradio
        const gradioResult = JSON.parse(mlResponse.data.data[0]);
        if (gradioResult && gradioResult.status === 'success') {
          // Convert Gradio result to expected format
          searchResults = {
            node_name: searchQuery,
            title: gradioResult.title,
            summary: gradioResult.summary,
            image_url: gradioResult.image_url || null,
            source_url: gradioResult.source_url,
            publication_date: new Date().toISOString().split('T')[0],
            wikipedia: gradioResult.wikipedia,
            web_results: gradioResult.web_results || [],
            enhanced_results: gradioResult.web_results || [],
            locations: [],
            geo_data: [],
            category: 'General',
            headline: gradioResult.title || searchQuery
          };
          console.log('Using HF Space Gradio search results');
        }
      }
    } catch (mlError) {
      console.log('HF Space search not available, using fallback web search:', mlError.message);
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