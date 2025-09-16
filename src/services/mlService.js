import axios from 'axios';

class MLService {
  constructor() {
    // HuggingFace Space URL
    this.mlServiceUrl = process.env.ML_SERVICE_URL || 'https://acauanrr-phylo-ml-service.hf.space';
  }

  /**
   * Generate phylogenetic tree from texts using ML service
   * @param {Array} texts - Array of text strings
   * @param {Array} labels - Array of labels for the texts
   * @returns {Object} Tree data with newick format
   */
  async generateTree(texts, labels = []) {
    try {
      // First try the enhanced API format
      let response;
      try {
        response = await axios.post(
          `${this.mlServiceUrl}/api/generate-tree`,
          {
            texts,
            labels
          },
          {
            headers: {
              'Content-Type': 'application/json'
            },
            timeout: 30000 // 30 seconds timeout
          }
        );
      } catch (firstError) {
        console.log('First API format failed, trying Gradio format:', firstError.response?.status);

        // If 422 error, try Gradio format
        if (firstError.response?.status === 422) {
          try {
            response = await axios.post(
              `${this.mlServiceUrl}/api/generate-tree`,
              {
                data: [texts, labels]  // Gradio format
              },
              {
                headers: {
                  'Content-Type': 'application/json'
                },
                timeout: 30000
              }
            );
          } catch (gradioError) {
            console.log('Gradio format also failed:', gradioError.response?.status);
            throw firstError; // Throw original error
          }
        } else {
          throw firstError;
        }
      }

      // Handle different response formats
      let result = response.data;

      // If it's a Gradio response, extract the actual data
      if (result.data && Array.isArray(result.data) && result.data[0]) {
        try {
          result = JSON.parse(result.data[0]);
        } catch (parseError) {
          console.log('Failed to parse Gradio response, using as-is');
        }
      }

      return result;
    } catch (error) {
      console.error('ML Service Error:', error.message);

      // Enhanced fallback with mock enhanced pipeline data
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' ||
          error.response?.status === 422 || error.response?.status === 500) {
        console.log('Using enhanced mock pipeline due to ML service issues');
        return this.generateEnhancedMockTree(texts, labels);
      }

      throw new Error(`ML Service Error: ${error.message}`);
    }
  }

  /**
   * Search using ML service
   * @param {String} query - Search query
   * @returns {Object} Search results
   */
  async search(query) {
    try {
      const response = await axios.post(
        `${this.mlServiceUrl}/api/search`,
        { query },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data;
    } catch (error) {
      console.error('ML Search Error:', error.message);
      throw new Error(`ML Search Error: ${error.message}`);
    }
  }

  /**
   * Health check for ML service
   * @returns {Object} Health status
   */
  async healthCheck() {
    try {
      const response = await axios.get(
        `${this.mlServiceUrl}/health`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  /**
   * Generate simple mock tree when HF Space is unavailable
   * @private
   */
  generateEnhancedMockTree(texts, labels) {
    const n = texts.length;
    const useLabels = labels.length === n ? labels : texts.map((_, i) => `Text_${i + 1}`);

    // Simple star topology as basic fallback
    let newick = '';
    if (n === 1) {
      newick = `${useLabels[0]}:0.0;`;
    } else if (n === 2) {
      newick = `(${useLabels[0]}:0.5,${useLabels[1]}:0.5);`;
    } else {
      const branches = useLabels.map(label => `${label}:0.5`);
      newick = `(${branches.join(',')});`;
    }

    // Basic clustering analysis for metadata
    const clusteringResult = this.analyzeTextClustering(texts, useLabels);

    return {
      status: 'success',
      newick,
      wordcloud_data: clusteringResult.wordcloudData,
      clustering_method: 'simple_fallback',
      cluster_names: clusteringResult.clusterNames,
      num_clusters: clusteringResult.clusterNames.length,
      has_rich_labels: clusteringResult.hasCategories,
      enhanced_labels: useLabels,
      clean_labels: useLabels,
      original_labels: labels,
      num_texts: n,
      num_labels: useLabels.length,
      mock: true,
      message: 'Using simple fallback (HF Space unavailable - proper phylogenetic reconstruction requires HF Space)'
    };
  }


  /**
   * Analyze text clustering for internal node labeling (secondary step)
   * @private
   */
  analyzeTextClustering(texts, labels) {
    // Detect if labels have category format
    const hasCategories = labels.some(label => label.match(/^[A-Z_]+_\d+_/));

    let clusterNames = [];
    let wordcloudData = [];

    if (hasCategories) {
      // Extract categories from enhanced labels
      const categoryMap = new Map();
      labels.forEach((label, idx) => {
        const match = label.match(/^([A-Z_]+)_\d+_/);
        if (match) {
          const category = match[1].replace(/_/g, ' ');
          if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
            clusterNames.push(category);
          }
          categoryMap.get(category).push(idx);
        }
      });

      wordcloudData = Array.from(categoryMap.entries()).map(([category, indices]) => ({
        categories: [category],
        category_counts: { [category]: indices.length },
        total_documents: indices.length
      }));
    } else {
      // Auto-discover clusters based on content
      const mockCategories = ['Technology', 'Politics', 'Sports', 'Science', 'Arts'];
      const assignedCategories = texts.map((text) => {
        const lowerText = text.toLowerCase();
        if (lowerText.includes('ai') || lowerText.includes('technology') || lowerText.includes('digital')) return 'Technology';
        if (lowerText.includes('government') || lowerText.includes('policy') || lowerText.includes('election')) return 'Politics';
        if (lowerText.includes('team') || lowerText.includes('sport') || lowerText.includes('championship')) return 'Sports';
        if (lowerText.includes('research') || lowerText.includes('discovery') || lowerText.includes('scientific')) return 'Science';
        if (lowerText.includes('art') || lowerText.includes('music') || lowerText.includes('exhibition')) return 'Arts';
        return mockCategories[Math.floor(Math.random() * mockCategories.length)];
      });

      clusterNames = [...new Set(assignedCategories)];

      wordcloudData = {
        categories: clusterNames,
        category_counts: clusterNames.reduce((acc, cat) => {
          acc[cat] = assignedCategories.filter(c => c === cat).length;
          return acc;
        }, {}),
        total_documents: texts.length
      };
    }

    return {
      clusterNames,
      wordcloudData,
      hasCategories
    };
  }

  /**
   * Generate simple mock tree for fallback (legacy)
   * @private
   */
  generateMockTree(texts, labels) {
    const n = texts.length;
    const useLabels = labels.length === n ? labels : texts.map((_, i) => `Text_${i + 1}`);

    // Simple mock tree
    let newick = '';
    if (n === 1) {
      newick = `${useLabels[0]}:0.0;`;
    } else if (n === 2) {
      newick = `(${useLabels[0]}:0.5,${useLabels[1]}:0.5);`;
    } else {
      const branches = useLabels.map(label => `${label}:0.5`);
      newick = `(${branches.join(',')});`;
    }

    return {
      status: 'success',
      newick,
      num_texts: n,
      num_labels: useLabels.length,
      mock: true,
      message: 'Using simple mock data (ML service unavailable)'
    };
  }
}

export default new MLService();