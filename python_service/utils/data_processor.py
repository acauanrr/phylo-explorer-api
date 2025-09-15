"""
Data processor for news dataset
Handles loading, sampling, and preprocessing of news articles
"""

import json
import random
import logging
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import pandas as pd

logger = logging.getLogger(__name__)


class NewsDataProcessor:
    """
    Process news category dataset for phylogenetic analysis
    """

    def __init__(self, dataset_path: Optional[str] = None):
        """
        Initialize the data processor

        Args:
            dataset_path: Path to the news dataset JSON file
        """
        self.dataset_path = dataset_path
        self.data = None
        self.processed_data = None

    def load_dataset(self, path: Optional[str] = None, sample_size: int = 200) -> List[Dict]:
        """
        Load and sample the news dataset

        Args:
            path: Path to dataset (uses self.dataset_path if None)
            sample_size: Number of articles to sample

        Returns:
            List of sampled articles
        """
        if path:
            self.dataset_path = path

        if not self.dataset_path:
            raise ValueError("Dataset path not provided")

        try:
            # Load the JSON lines file
            articles = []
            with open(self.dataset_path, 'r', encoding='utf-8') as f:
                for line in f:
                    if line.strip():
                        articles.append(json.loads(line))

            logger.info(f"Loaded {len(articles)} articles from dataset")

            # Sample articles if needed
            if sample_size and len(articles) > sample_size:
                # Stratified sampling by category if possible
                df = pd.DataFrame(articles)
                if 'category' in df.columns:
                    # Sample proportionally from each category
                    sampled = df.groupby('category', group_keys=False).apply(
                        lambda x: x.sample(
                            min(len(x), max(1, int(sample_size * len(x) / len(df)))),
                            random_state=42
                        )
                    )
                    articles = sampled.to_dict('records')
                else:
                    articles = random.sample(articles, sample_size)

                logger.info(f"Sampled {len(articles)} articles")

            self.data = articles
            return articles

        except Exception as e:
            logger.error(f"Failed to load dataset: {e}")
            raise

    def prepare_texts_for_embedding(self,
                                   use_title: bool = True,
                                   use_description: bool = True,
                                   use_category: bool = True) -> Tuple[List[str], List[str]]:
        """
        Prepare texts for embedding generation

        Args:
            use_title: Include article title
            use_description: Include short description
            use_category: Include category

        Returns:
            Tuple of (texts for embedding, labels for tree nodes)
        """
        if not self.data:
            raise ValueError("No data loaded. Run load_dataset first.")

        texts = []
        labels = []

        for idx, article in enumerate(self.data):
            # Combine different fields for embedding
            text_parts = []

            if use_category and 'category' in article:
                text_parts.append(f"Category: {article['category']}")

            if use_title and 'headline' in article:
                text_parts.append(f"Title: {article['headline']}")

            if use_description and 'short_description' in article:
                text_parts.append(f"Description: {article['short_description']}")

            # Combine text parts
            text = " ".join(text_parts)
            texts.append(text)

            # Create label (use headline or a truncated version)
            if 'headline' in article:
                # Truncate headline for label if too long
                headline = article['headline'][:50]
                if len(article['headline']) > 50:
                    headline += "..."
                label = f"{article.get('category', 'Unknown')}_{idx:03d}_{headline}"
            else:
                label = f"Article_{idx:03d}"

            # Clean label for Newick format (remove problematic characters)
            label = label.replace(':', '_').replace(';', '_').replace('(', '_').replace(')', '_')
            label = label.replace(',', '_').replace('[', '_').replace(']', '_')
            label = label.replace("'", '').replace('"', '').replace(' ', '_')

            labels.append(label)

        self.processed_data = {
            'texts': texts,
            'labels': labels,
            'articles': self.data
        }

        return texts, labels

    def get_article_metadata(self) -> List[Dict]:
        """
        Extract metadata from articles for visualization

        Returns:
            List of metadata dictionaries
        """
        if not self.data:
            raise ValueError("No data loaded. Run load_dataset first.")

        metadata = []
        for article in self.data:
            meta = {
                'category': article.get('category', 'Unknown'),
                'headline': article.get('headline', ''),
                'authors': article.get('authors', ''),
                'date': article.get('date', ''),
                'link': article.get('link', '')
            }
            metadata.append(meta)

        return metadata

    def get_category_distribution(self) -> Dict[str, int]:
        """
        Get distribution of articles by category

        Returns:
            Dictionary with category counts
        """
        if not self.data:
            raise ValueError("No data loaded. Run load_dataset first.")

        categories = {}
        for article in self.data:
            category = article.get('category', 'Unknown')
            categories[category] = categories.get(category, 0) + 1

        return categories

    def export_processed_data(self, output_path: str):
        """
        Export processed data to JSON for debugging/analysis

        Args:
            output_path: Path to save processed data
        """
        if not self.processed_data:
            raise ValueError("No processed data available. Run prepare_texts_for_embedding first.")

        export_data = {
            'texts': self.processed_data['texts'],
            'labels': self.processed_data['labels'],
            'metadata': self.get_article_metadata(),
            'category_distribution': self.get_category_distribution()
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported processed data to {output_path}")