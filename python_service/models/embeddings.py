"""
SBERT Embedding Model for Text Similarity
Uses sentence-transformers to generate 768-dimensional embeddings
"""

from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List, Union
import logging

logger = logging.getLogger(__name__)


class EmbeddingModel:
    """
    Wrapper for SBERT model to generate embeddings for text data
    """

    def __init__(self, model_name: str = 'all-mpnet-base-v2'):
        """
        Initialize the SBERT model

        Args:
            model_name: Name of the pre-trained model to use
                       Default: 'all-mpnet-base-v2' (768-dimensional embeddings)
        """
        try:
            self.model = SentenceTransformer(model_name)
            self.embedding_dim = self.model.get_sentence_embedding_dimension()
            logger.info(f"Loaded model {model_name} with {self.embedding_dim} dimensions")
        except Exception as e:
            logger.error(f"Failed to load model {model_name}: {e}")
            raise

    def encode(self, texts: Union[str, List[str]],
               batch_size: int = 32,
               show_progress_bar: bool = True) -> np.ndarray:
        """
        Generate embeddings for text(s)

        Args:
            texts: Single text or list of texts to encode
            batch_size: Batch size for encoding
            show_progress_bar: Whether to show progress bar

        Returns:
            numpy array of embeddings
        """
        if isinstance(texts, str):
            texts = [texts]

        embeddings = self.model.encode(
            texts,
            batch_size=batch_size,
            show_progress_bar=show_progress_bar,
            convert_to_numpy=True
        )

        return embeddings

    def compute_similarity_matrix(self, embeddings: np.ndarray) -> np.ndarray:
        """
        Compute pairwise cosine similarity matrix

        Args:
            embeddings: numpy array of embeddings

        Returns:
            Similarity matrix
        """
        # Normalize embeddings
        embeddings_norm = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        # Compute cosine similarity
        similarity_matrix = np.dot(embeddings_norm, embeddings_norm.T)

        return similarity_matrix

    def compute_distance_matrix(self, embeddings: np.ndarray,
                               metric: str = 'cosine') -> np.ndarray:
        """
        Compute pairwise distance matrix for phylogenetic analysis

        Args:
            embeddings: numpy array of embeddings
            metric: Distance metric ('cosine', 'euclidean')

        Returns:
            Distance matrix
        """
        if metric == 'cosine':
            # Convert cosine similarity to distance
            similarity = self.compute_similarity_matrix(embeddings)
            # Distance = 1 - similarity
            distance_matrix = 1 - similarity
        elif metric == 'euclidean':
            # Compute Euclidean distance
            from scipy.spatial.distance import cdist
            distance_matrix = cdist(embeddings, embeddings, metric='euclidean')
        else:
            raise ValueError(f"Unsupported metric: {metric}")

        # Ensure the diagonal is zero
        np.fill_diagonal(distance_matrix, 0)

        return distance_matrix