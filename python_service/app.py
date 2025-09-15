"""
Flask API server for phylogenetic analysis service
"""

import os
import json
import logging
import asyncio
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import tempfile

from pipeline import NewsPhylogeneticPipeline
from agents.search_agent import SearchAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
ALLOWED_EXTENSIONS = {'json', 'txt'}

# Initialize pipeline (loaded once to cache the model)
pipeline = None


def get_pipeline():
    """Get or initialize the pipeline"""
    global pipeline
    if pipeline is None:
        logger.info("Initializing phylogenetic pipeline...")
        pipeline = NewsPhylogeneticPipeline()
        logger.info("Pipeline initialized successfully")
    return pipeline


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'service': 'phylogenetic-analysis'})


@app.route('/api/process-news', methods=['POST'])
def process_news_dataset():
    """
    Process news dataset and generate phylogenetic tree
    Expects JSON payload with dataset path or file upload
    """
    try:
        # Get pipeline instance
        pipe = get_pipeline()

        # Check if file was uploaded
        if 'file' in request.files:
            file = request.files['file']
            if file and allowed_file(file.filename):
                # Save uploaded file temporarily
                with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as tmp:
                    file.save(tmp.name)
                    dataset_path = tmp.name
            else:
                return jsonify({'error': 'Invalid file format'}), 400
        else:
            # Use default dataset path
            data = request.get_json()
            dataset_path = data.get('dataset_path')
            if not dataset_path:
                # Use the default news dataset
                dataset_path = "../../phylo-explorer-front/public/datasets/json/News_Category_Dataset_v3.json"

        # Get sample size from request
        sample_size = request.json.get('sample_size', 200) if request.is_json else 200

        # Process the dataset
        logger.info(f"Processing dataset: {dataset_path} with sample size: {sample_size}")
        results = pipe.process_news_dataset(
            dataset_path=dataset_path,
            sample_size=sample_size
        )

        # Generate visualization data
        viz_data = pipe.generate_visualization_data()

        # Clean up temporary file if it exists
        if 'file' in request.files:
            os.unlink(dataset_path)

        return jsonify({
            'success': True,
            'data': viz_data,
            'statistics': results['statistics']
        })

    except Exception as e:
        logger.error(f"Error processing dataset: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/process-text', methods=['POST'])
def process_text_input():
    """
    Process raw text input for phylogenetic analysis
    """
    try:
        data = request.get_json()
        texts = data.get('texts', [])
        labels = data.get('labels', None)

        if not texts:
            return jsonify({'error': 'No texts provided'}), 400

        # Generate labels if not provided
        if not labels:
            labels = [f"Text_{i:03d}" for i in range(len(texts))]

        # Get pipeline
        pipe = get_pipeline()

        # Generate embeddings
        logger.info(f"Generating embeddings for {len(texts)} texts")
        embeddings = pipe.embedding_model.encode(texts)

        # Compute distance matrix
        distance_matrix = pipe.embedding_model.compute_distance_matrix(embeddings)

        # Construct tree
        phylo_results = pipe.phylo_pipeline.run_pipeline(distance_matrix, labels)

        return jsonify({
            'success': True,
            'newick': phylo_results['newick'],
            'statistics': phylo_results['statistics'],
            'clusters': phylo_results['clusters']
        })

    except Exception as e:
        logger.error(f"Error processing text: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate-newick', methods=['GET'])
def generate_newick_file():
    """
    Generate and return a Newick file for the news dataset
    """
    try:
        pipe = get_pipeline()

        # Process default news dataset
        dataset_path = "../../phylo-explorer-front/public/datasets/json/News_Category_Dataset_v3.json"
        output_dir = "../../phylo-explorer-front/public/datasets/newicks"

        # Create output directory if it doesn't exist
        Path(output_dir).mkdir(parents=True, exist_ok=True)

        # Process dataset
        results = pipe.process_news_dataset(
            dataset_path=dataset_path,
            sample_size=200,
            output_dir=output_dir
        )

        # Save as news.txt
        newick_path = Path(output_dir) / "news.txt"
        with open(newick_path, 'w') as f:
            f.write(results['newick'])

        return jsonify({
            'success': True,
            'message': 'Newick file generated successfully',
            'path': str(newick_path),
            'statistics': results['statistics']
        })

    except Exception as e:
        logger.error(f"Error generating Newick file: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/available-datasets', methods=['GET'])
def get_available_datasets():
    """
    Get list of available datasets
    """
    datasets = [
        {
            'name': 'Life Tree',
            'file': 'life.txt',
            'type': 'newick',
            'description': 'Complete tree of life'
        },
        {
            'name': 'Animals',
            'file': 'animals.txt',
            'type': 'newick',
            'description': 'Animal phylogenetic tree'
        },
        {
            'name': 'News Articles',
            'file': 'news.txt',
            'type': 'newick',
            'description': 'News articles analyzed with SBERT embeddings'
        },
        {
            'name': 'News Dataset (JSON)',
            'file': 'News_Category_Dataset_v3.json',
            'type': 'json',
            'description': 'Raw news dataset for processing'
        }
    ]

    return jsonify({'datasets': datasets})


@app.route('/api/model-info', methods=['GET'])
def get_model_info():
    """
    Get information about the embedding model
    """
    try:
        pipe = get_pipeline()
        model_info = {
            'model_name': 'all-mpnet-base-v2',
            'embedding_dimension': pipe.embedding_model.embedding_dim,
            'description': 'SBERT model for semantic similarity',
            'algorithm': 'Neighbor Joining',
            'distance_metric': 'Cosine distance'
        }
        return jsonify(model_info)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search-node', methods=['POST'])
def search_node_info():
    """
    Search for information about a selected node
    """
    try:
        data = request.json
        node_name = data.get('node_name')
        node_type = data.get('node_type', 'general')

        if not node_name:
            return jsonify({'error': 'node_name is required'}), 400

        logger.info(f"Searching information for node: {node_name}")

        # Run async search in sync context
        async def run_search():
            async with SearchAgent() as agent:
                return await agent.get_node_information(node_name, node_type)

        # Execute async function
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            results = loop.run_until_complete(run_search())
        finally:
            loop.close()

        return jsonify({
            'success': True,
            'data': results
        })

    except Exception as e:
        logger.error(f"Error searching node information: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    # Development server
    port = int(os.environ.get('PYTHON_SERVICE_PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)