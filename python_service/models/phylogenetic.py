"""
Neighbor Joining Algorithm for Phylogenetic Tree Reconstruction
"""

import numpy as np
from typing import List, Dict, Tuple, Optional
from skbio import DistanceMatrix
from skbio.tree import nj
import logging

logger = logging.getLogger(__name__)


class NeighborJoining:
    """
    Implementation of the Neighbor Joining algorithm for phylogenetic tree reconstruction
    """

    def __init__(self):
        self.tree = None
        self.labels = None

    def construct_tree(self, distance_matrix: np.ndarray,
                       labels: List[str]) -> 'skbio.TreeNode':
        """
        Construct a phylogenetic tree using the Neighbor Joining algorithm

        Args:
            distance_matrix: Pairwise distance matrix
            labels: List of labels for the leaves

        Returns:
            TreeNode object representing the phylogenetic tree
        """
        if len(labels) != distance_matrix.shape[0]:
            raise ValueError("Number of labels must match distance matrix dimensions")

        self.labels = labels

        # Create skbio DistanceMatrix
        dm = DistanceMatrix(distance_matrix, ids=labels)

        # Apply Neighbor Joining algorithm
        try:
            self.tree = nj(dm)
            logger.info(f"Successfully constructed tree with {len(labels)} leaves")
        except Exception as e:
            logger.error(f"Failed to construct tree: {e}")
            raise

        return self.tree

    def name_internal_nodes(self, tree: Optional['skbio.TreeNode'] = None) -> None:
        """
        Assign names to internal nodes based on descendant categories

        Args:
            tree: TreeNode object (uses self.tree if None)
        """
        if tree is None:
            tree = self.tree

        if tree is None:
            raise ValueError("No tree available. Run construct_tree first.")

        def get_common_category(node):
            """Get the most common category from descendant leaves"""
            if node.is_tip():
                # Extract category from leaf name (e.g., "POLITICS_001_..." -> "POLITICS")
                if node.name and '_' in node.name:
                    return node.name.split('_')[0]
                return None

            # Get categories from all descendants
            categories = []
            for tip in node.tips():
                if tip.name and '_' in tip.name:
                    category = tip.name.split('_')[0]
                    categories.append(category)

            if not categories:
                return None

            # Find most common category
            from collections import Counter
            category_counts = Counter(categories)
            most_common = category_counts.most_common(1)[0]

            # If one category dominates (>50%), use it; otherwise use mixed
            if most_common[1] > len(categories) * 0.5:
                return f"{most_common[0]}_cluster"
            else:
                # Get top 2 categories for mixed nodes
                top_categories = category_counts.most_common(2)
                if len(top_categories) >= 2:
                    return f"{top_categories[0][0]}_{top_categories[1][0]}_mixed"
                else:
                    return f"{top_categories[0][0]}_cluster"

        # Name all internal nodes
        for node in tree.non_tips():
            if not node.name:  # Only name unnamed nodes
                category_name = get_common_category(node)
                if category_name:
                    # Add a unique identifier to avoid duplicate names
                    node.name = category_name

        # Ensure unique names by adding counters where needed
        name_counts = {}
        for node in tree.non_tips():
            if node.name:
                if node.name in name_counts:
                    name_counts[node.name] += 1
                    node.name = f"{node.name}_{name_counts[node.name]}"
                else:
                    name_counts[node.name] = 1

    def tree_to_newick(self, tree: Optional['skbio.TreeNode'] = None,
                       name_internals: bool = True) -> str:
        """
        Convert tree to Newick format string

        Args:
            tree: TreeNode object (uses self.tree if None)
            name_internals: Whether to name internal nodes

        Returns:
            Newick format string
        """
        if tree is None:
            tree = self.tree

        if tree is None:
            raise ValueError("No tree available. Run construct_tree first.")

        # Name internal nodes if requested
        if name_internals:
            self.name_internal_nodes(tree)

        # Convert to Newick format
        newick_str = str(tree)

        return newick_str

    def get_tree_statistics(self) -> Dict:
        """
        Get basic statistics about the constructed tree

        Returns:
            Dictionary containing tree statistics
        """
        if self.tree is None:
            raise ValueError("No tree available. Run construct_tree first.")

        stats = {
            'num_tips': len(list(self.tree.tips())),
            'num_internal_nodes': len(list(self.tree.non_tips())),
            'total_branch_length': self.tree.total_length(),
            'max_distance_to_root': max(self.tree.tip_tip_distances().condensed_form()),
        }

        return stats

    def find_clusters(self, threshold: float = 0.5) -> List[List[str]]:
        """
        Find clusters in the tree based on distance threshold

        Args:
            threshold: Distance threshold for clustering

        Returns:
            List of clusters (each cluster is a list of labels)
        """
        if self.tree is None:
            raise ValueError("No tree available. Run construct_tree first.")

        clusters = []
        visited = set()

        def traverse_and_cluster(node, current_cluster, accumulated_distance=0):
            if node.name and node.name not in visited:
                if accumulated_distance <= threshold:
                    current_cluster.append(node.name)
                    visited.add(node.name)
                else:
                    if current_cluster:
                        clusters.append(current_cluster)
                    current_cluster = [node.name] if node.name else []
                    visited.add(node.name) if node.name else None
                    accumulated_distance = 0

            for child in node.children:
                edge_length = child.length if child.length else 0
                traverse_and_cluster(
                    child,
                    current_cluster.copy(),
                    accumulated_distance + edge_length
                )

        initial_cluster = []
        traverse_and_cluster(self.tree, initial_cluster)

        # Add any remaining cluster
        if initial_cluster:
            clusters.append(initial_cluster)

        # Add any unvisited tips as single-element clusters
        all_tips = set(tip.name for tip in self.tree.tips() if tip.name)
        for tip in all_tips - visited:
            clusters.append([tip])

        return clusters


class PhylogeneticPipeline:
    """
    Complete pipeline for phylogenetic analysis
    """

    def __init__(self):
        self.nj = NeighborJoining()
        self.distance_matrix = None
        self.labels = None
        self.tree = None

    def run_pipeline(self, distance_matrix: np.ndarray,
                    labels: List[str]) -> Dict:
        """
        Run the complete phylogenetic analysis pipeline

        Args:
            distance_matrix: Pairwise distance matrix
            labels: List of labels

        Returns:
            Dictionary containing results
        """
        self.distance_matrix = distance_matrix
        self.labels = labels

        # Construct tree
        self.tree = self.nj.construct_tree(distance_matrix, labels)

        # Get Newick format
        newick = self.nj.tree_to_newick()

        # Get statistics
        stats = self.nj.get_tree_statistics()

        # Find clusters
        clusters = self.nj.find_clusters()

        results = {
            'newick': newick,
            'statistics': stats,
            'clusters': clusters,
            'num_sequences': len(labels)
        }

        return results