"""
Main pipeline for phylogenetic analysis using SBERT embeddings
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, Optional
import numpy as np

from models.embeddings import EmbeddingModel
from models.phylogenetic import PhylogeneticPipeline
from utils.data_processor import NewsDataProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class NewsPhylogeneticPipeline:
    """
    Complete pipeline for news article phylogenetic analysis
    """

    def __init__(self, model_name: str = 'all-mpnet-base-v2'):
        """
        Initialize the pipeline

        Args:
            model_name: SBERT model name (768-dimensional)
        """
        self.embedding_model = EmbeddingModel(model_name)
        self.phylo_pipeline = PhylogeneticPipeline()
        self.data_processor = NewsDataProcessor()
        self.results = None

    def process_news_dataset(self,
                           dataset_path: str,
                           sample_size: int = 200,
                           output_dir: Optional[str] = None) -> Dict:
        """
        Process news dataset through the complete pipeline

        Args:
            dataset_path: Path to news dataset
            sample_size: Number of articles to process
            output_dir: Directory to save outputs

        Returns:
            Dictionary containing all results
        """
        logger.info("Starting news phylogenetic analysis pipeline")

        # Step 1: Load and sample dataset
        logger.info("Loading dataset...")
        articles = self.data_processor.load_dataset(dataset_path, sample_size)

        # Step 2: Prepare texts for embedding
        logger.info("Preparing texts for embedding...")
        texts, labels = self.data_processor.prepare_texts_for_embedding()

        # Step 3: Generate embeddings
        logger.info("Generating SBERT embeddings...")
        embeddings = self.embedding_model.encode(texts, show_progress_bar=True)
        logger.info(f"Generated embeddings with shape: {embeddings.shape}")

        # Step 4: Compute distance matrix
        logger.info("Computing distance matrix...")
        distance_matrix = self.embedding_model.compute_distance_matrix(embeddings)

        # Step 5: Construct phylogenetic tree
        logger.info("Constructing phylogenetic tree using Neighbor Joining...")
        phylo_results = self.phylo_pipeline.run_pipeline(distance_matrix, labels)

        # Step 6: Prepare complete results
        metadata = self.data_processor.get_article_metadata()
        category_dist = self.data_processor.get_category_distribution()

        self.results = {
            'newick': phylo_results['newick'],
            'statistics': phylo_results['statistics'],
            'clusters': phylo_results['clusters'],
            'metadata': metadata,
            'category_distribution': category_dist,
            'num_articles': len(articles),
            'embedding_dim': self.embedding_model.embedding_dim,
            'labels': labels
        }

        # Step 7: Save outputs if requested
        if output_dir:
            self._save_outputs(output_dir)

        logger.info("Pipeline completed successfully")
        return self.results

    def _save_outputs(self, output_dir: str):
        """
        Save pipeline outputs to files

        Args:
            output_dir: Directory to save outputs
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        # Save Newick file
        newick_path = output_path / "news_tree.txt"
        with open(newick_path, 'w') as f:
            f.write(self.results['newick'])
        logger.info(f"Saved Newick tree to {newick_path}")

        # Save metadata and results
        results_path = output_path / "analysis_results.json"
        save_results = {
            k: v for k, v in self.results.items()
            if k != 'newick'  # Newick saved separately
        }
        with open(results_path, 'w') as f:
            json.dump(save_results, f, indent=2)
        logger.info(f"Saved analysis results to {results_path}")

    def generate_visualization_data(self) -> Dict:
        """
        Generate data formatted for frontend visualization

        Returns:
            Dictionary ready for frontend consumption
        """
        if not self.results:
            raise ValueError("No results available. Run process_news_dataset first.")

        # Extract word frequency from labels
        word_freq = {}
        for label in self.results['labels']:
            # Extract category from label
            category = label.split('_')[0]
            word_freq[category] = word_freq.get(category, 0) + 1

        # Format word cloud data
        wordcloud_data = [
            {'word': word, 'qtd': count}
            for word, count in word_freq.items()
        ]

        # Format timeline data (mock temporal data for now)
        timeline_data = self._generate_mock_timeline_data()

        viz_data = {
            'phyloNewickData': self.results['newick'],
            'wordcloudData': wordcloud_data,
            'timevisData': timeline_data,
            'metadata': self.results['metadata'][:50],  # Limit metadata for performance
            'statistics': self.results['statistics']
        }

        return viz_data

    def _generate_mock_timeline_data(self) -> list:
        """
        Generate mock timeline data for visualization
        This would be replaced with actual temporal analysis

        Returns:
            Timeline data for visualization
        """
        categories = list(self.results['category_distribution'].keys())
        timeline_data = []

        # Generate mock temporal data
        for t in range(20):
            point = {'time': t}
            for cat in categories[:10]:  # Limit to top 10 categories
                point[cat] = np.random.randint(1, 10)
            timeline_data.append(point)

        return timeline_data


def run_standalone_pipeline(dataset_path: str,
                           output_dir: str,
                           sample_size: int = 200):
    """
    Run the pipeline as a standalone script

    Args:
        dataset_path: Path to news dataset
        output_dir: Directory for outputs
        sample_size: Number of articles to process
    """
    pipeline = NewsPhylogeneticPipeline()
    results = pipeline.process_news_dataset(
        dataset_path=dataset_path,
        sample_size=sample_size,
        output_dir=output_dir
    )

    print(f"\nPipeline Results:")
    print(f"- Processed {results['num_articles']} articles")
    print(f"- Tree statistics: {results['statistics']}")
    print(f"- Found {len(results['clusters'])} clusters")
    print(f"- Category distribution: {results['category_distribution']}")

    return results


if __name__ == "__main__":
    # Example usage
    import sys

    if len(sys.argv) < 3:
        print("Usage: python pipeline.py <dataset_path> <output_dir> [sample_size]")
        sys.exit(1)

    dataset_path = sys.argv[1]
    output_dir = sys.argv[2]
    sample_size = int(sys.argv[3]) if len(sys.argv) > 3 else 200

    run_standalone_pipeline(dataset_path, output_dir, sample_size)