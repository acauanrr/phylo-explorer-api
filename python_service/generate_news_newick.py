#!/usr/bin/env python3
"""
Standalone script to generate Newick file from news dataset
This can be run independently to pre-generate the news tree
"""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from pipeline import NewsPhylogeneticPipeline


def main():
    """Generate news Newick file"""

    # Paths
    project_root = Path(__file__).parent.parent.parent
    dataset_path = project_root / "phylo-explorer-front/public/datasets/json/News_Category_Dataset_v3.json"
    output_dir = project_root / "phylo-explorer-front/public/datasets/newicks"

    # Check if dataset exists
    if not dataset_path.exists():
        print(f"Error: Dataset not found at {dataset_path}")
        sys.exit(1)

    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("News Dataset Phylogenetic Analysis")
    print("=" * 60)
    print(f"Dataset: {dataset_path}")
    print(f"Output: {output_dir}")
    print("-" * 60)

    # Initialize pipeline
    print("Initializing pipeline...")
    pipeline = NewsPhylogeneticPipeline()

    # Process dataset
    print("Processing news dataset (this may take a few minutes)...")
    results = pipeline.process_news_dataset(
        dataset_path=str(dataset_path),
        sample_size=200,
        output_dir=str(output_dir)
    )

    # Rename output file to news.txt
    newick_file = output_dir / "news_tree.txt"
    news_file = output_dir / "news.txt"

    if newick_file.exists():
        newick_file.rename(news_file)
        print(f"\nNewick file saved as: {news_file}")

    # Print results summary
    print("\n" + "=" * 60)
    print("Analysis Complete!")
    print("=" * 60)
    print(f"Articles processed: {results['num_articles']}")
    print(f"Embedding dimensions: {results['embedding_dim']}")
    print("\nTree Statistics:")
    for key, value in results['statistics'].items():
        print(f"  - {key}: {value}")
    print(f"\nClusters found: {len(results['clusters'])}")
    print("\nCategory Distribution:")
    for category, count in sorted(results['category_distribution'].items(),
                                 key=lambda x: x[1], reverse=True)[:10]:
        print(f"  - {category}: {count}")

    print("\n" + "=" * 60)
    print("Files created:")
    print(f"  - {news_file}")
    print(f"  - {output_dir / 'analysis_results.json'}")
    print("=" * 60)


if __name__ == "__main__":
    main()