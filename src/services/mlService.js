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
      const response = await axios.post(
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

      return response.data;
    } catch (error) {
      console.error('ML Service Error:', error.message);

      // Fallback to mock data if ML service is unavailable
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return this.generateMockTree(texts, labels);
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
   * Generate mock tree for fallback
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
      message: 'Using mock data (ML service unavailable)'
    };
  }
}

export default new MLService();