import express from 'express';
import mlService from '../services/mlService.js';

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
 * Search for node information
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

    // For now, return mock data that matches the expected format
    // This will be replaced with actual search functionality later
    const mockData = {
      node_name: searchQuery,
      node_type: node_type || 'general',
      title: searchQuery.replace(/_/g, ' '),
      description: `Information about ${searchQuery}`,
      content: `This is detailed content for the node: ${searchQuery}`,
      metadata: {
        created_at: new Date().toISOString(),
        category: node_type || 'general'
      },
      locations: [],
      geo_data: []
    };

    res.json({
      success: true,
      data: mockData,
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