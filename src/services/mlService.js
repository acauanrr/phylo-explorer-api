import { client } from '@gradio/client';

class MLService {
  constructor() {
    // Environment-based configuration
    this.useLocal = process.env.NODE_ENV === 'development';
    this.localUrl = process.env.ML_SERVICE_LOCAL_URL || 'http://localhost:5000';
    this.hfUrl = process.env.ML_SERVICE_HF_URL || 'https://acauanrr-phylo-ml-service.hf.space';
    this.hfSpaceId = 'acauanrr/phylo-ml-service';

    // Debug environment configuration
    console.log('🔧 MLService Configuration:');
    console.log('   NODE_ENV:', process.env.NODE_ENV);
    console.log('   useLocal:', this.useLocal);
    console.log('   localUrl:', this.localUrl);
    console.log('   hfUrl:', this.hfUrl);
  }

  /**
   * Generate phylogenetic tree from texts using ML service
   * @param {Array} texts - Array of text strings
   * @param {Array} labels - Array of labels for the texts
   * @returns {Object} Tree data with newick format
   */
  async generateTree(texts, labels = []) {
    console.log('🚀 generateTree called with:', { texts, labels, useLocal: this.useLocal, NODE_ENV: process.env.NODE_ENV });
    try {
      let result;

      if (this.useLocal) {
        // For local development, try direct Flask API first
        console.log('🔍 Attempting to connect to local ML service at:', this.localUrl);
        console.log('📋 NODE_ENV:', process.env.NODE_ENV);
        console.log('🏠 useLocal:', this.useLocal);
        try {
          const axios = (await import('axios')).default;
          console.log('📤 Sending request to local Flask API...');
          const response = await axios.post(
            `${this.localUrl}/api/generate-tree`,
            { texts, labels },
            {
              headers: { 'Content-Type': 'application/json' },
              timeout: 30000
            }
          );

          // Process Flask API JSON response
          const flaskResponse = response.data;
          console.log('📤 Sending request to local Flask API...');
          console.log('Flask response status:', flaskResponse?.status);
          console.log('Flask response newick:', flaskResponse?.newick);
          console.log('Flask response original_labels:', flaskResponse?.original_labels);
          console.log('Full Flask response:', JSON.stringify(flaskResponse, null, 2));

          if (flaskResponse.status === 'success' && flaskResponse.newick) {
            result = {
              status: 'success',
              newick: flaskResponse.newick,
              num_texts: flaskResponse.num_texts || texts.length,
              num_labels: flaskResponse.original_labels ? flaskResponse.original_labels.length : (flaskResponse.num_texts || labels.length),
              enhanced_labels: flaskResponse.enhanced_labels,
              statistics: flaskResponse.statistics,
              cluster_names: flaskResponse.cluster_names,
              wordcloud_data: flaskResponse.wordcloud_data,
              color_data: flaskResponse.color_data
            };
          } else {
            // Fallback for error responses
            result = {
              status: 'success',
              newick: '(fallback);',
              raw_output: `Error: ${flaskResponse.error || 'Unknown error'}`,
              num_texts: texts.length,
              num_labels: labels.length
            };
          }
        } catch (localError) {
          console.log('Local Flask API failed, trying Gradio client for local:', localError.message);
          throw localError; // For now, don't try Gradio for local
        }
      } else {
        // For production, use Gradio client to connect to HuggingFace Space
        console.log('Connecting to HuggingFace Space via Gradio client...');

        const app = await client(this.hfSpaceId);

        // Format inputs as JSON strings as expected by the Gradio interface
        const textsJson = JSON.stringify(texts);
        const labelsJson = JSON.stringify(labels || []);

        // Call the /generate-tree endpoint
        const response = await app.predict("/generate-tree", [textsJson, labelsJson]);

        console.log('Gradio response:', response);

        // Parse the Gradio response
        if (response && response.data && response.data[0]) {
          const gradioOutput = response.data[0];

          // Extract Newick tree from the text output
          const newickMatch = gradioOutput.match(/🌳 Enhanced Newick Tree:\s*\n(.+?)(\n|$)/);
          if (newickMatch) {
            const newick = newickMatch[1].trim();

            // Extract other information
            const numTextsMatch = gradioOutput.match(/Number of texts: (\d+)/);
            const numLabelsMatch = gradioOutput.match(/Number of labels: (\d+)/);

            result = {
              status: 'success',
              newick: newick,
              num_texts: numTextsMatch ? parseInt(numTextsMatch[1]) : texts.length,
              num_labels: numLabelsMatch ? parseInt(numLabelsMatch[1]) : labels.length
            };
          } else {
            // If we can't parse the output, return it for debugging
            result = {
              status: 'success',
              newick: '(fallback);',
              raw_output: gradioOutput,
              num_texts: texts.length,
              num_labels: labels.length
            };
          }
        } else {
          throw new Error('Invalid response from Gradio client');
        }
      }

      return result;
    } catch (error) {
      console.error('ML Service Error:', error.message);
      throw new Error(`ML Service Error: ${error.message}. ${this.useLocal ? 'Local ML service' : 'HuggingFace Space'} required for phylogenetic reconstruction.`);
    }
  }

  /**
   * Search using ML service
   * @param {String} query - Search query
   * @returns {Object} Search results
   */
  async search(query) {
    try {
      if (this.useLocal) {
        // For local development, use direct Flask API
        const axios = (await import('axios')).default;
        const response = await axios.post(
          `${this.localUrl}/api/search`,
          { query },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
          }
        );
        return response.data;
      } else {
        // For production, use Gradio client
        const app = await client(this.hfSpaceId);
        const response = await app.predict("/search_node", [query]);

        // Parse the JSON response from Gradio
        if (response && response.data && response.data[0]) {
          return JSON.parse(response.data[0]);
        } else {
          throw new Error('Invalid search response from Gradio client');
        }
      }
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
      if (this.useLocal) {
        // For local development, use direct Flask API
        const axios = (await import('axios')).default;
        const response = await axios.get(`${this.localUrl}/health`, { timeout: 5000 });
        return response.data;
      } else {
        // For HuggingFace Space, we can't directly check health, so assume it's healthy if we can connect
        const app = await client(this.hfSpaceId);
        return {
          status: 'healthy',
          service: 'phylo-ml-service',
          mode: 'huggingface-space'
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

}

export default new MLService();