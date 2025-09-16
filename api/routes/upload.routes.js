import { Router } from "express";
import Papa from "papaparse";
import { multerConfig, validateFileUpload } from "../../middleware/validation.js";
import mlService from "../../src/services/mlService.js";

const router = new Router();

// Helper function to normalize data structure
function normalizeData(data, fileType = 'csv') {
  const normalized = [];

  if (fileType === 'json') {
    // Handle JSON data
    data.forEach((item, index) => {
      normalized.push({
        id: item.id || index + 1,
        title: item.title || item.headline || item.name || `Document ${index + 1}`,
        content: item.content || item.short_description || item.description || item.text || "",
        date: item.date || item.pubDate || item.published_date || "",
        category: item.category || item.label || "",
        location: item.location || "",
        authors: item.authors || item.author || "",
        link: item.link || item.url || ""
      });
    });
  } else {
    // Handle CSV data - already parsed
    data.forEach((item, index) => {
      normalized.push({
        id: item.id || index + 1,
        title: item.title || item.headline || item.name || `Document ${index + 1}`,
        content: item.content || item.text || item.description || "",
        date: item.date || item.pubdate || item.published_date || "",
        category: item.category || item.label || "",
        location: item.location || "",
        authors: item.authors || item.author || "",
        link: item.link || item.url || ""
      });
    });
  }

  return normalized;
}

// Process data using the enhanced ML service
async function processDataWithEnhancedPipeline(normalizedData) {
  try {
    // Extract texts and labels for the enhanced pipeline
    const texts = normalizedData.map(item => {
      // Combine title and content for richer text analysis
      const fullText = [item.title, item.content].filter(Boolean).join('. ');
      return fullText || item.title || `Document ${item.id}`;
    });

    // Create enhanced labels that include category information if available
    const labels = normalizedData.map((item, index) => {
      if (item.category && item.category.trim()) {
        // Format: CATEGORY_NUMBER_TITLE (enhanced format for clustering)
        const cleanCategory = item.category.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
        const cleanTitle = (item.title || `Document_${item.id}`).replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
        return `${cleanCategory}_${String(index + 1).padStart(3, '0')}_${cleanTitle}`;
      } else {
        // Simple format for uncategorized data (will trigger auto-discovery)
        return item.title || `Document_${item.id}`;
      }
    });

    console.log(`Processing ${texts.length} documents with enhanced pipeline`);
    console.log(`Labels format: ${labels[0]}`); // Log first label to verify format

    // Call the enhanced ML service
    const mlResult = await mlService.generateTree(texts, labels);

    // Transform ML service response to expected frontend format
    const result = {
      objData: normalizedData,
      phyloNewickData: mlResult.newick || mlResult.phyloNewickData,
      wordcloudData: mlResult.wordcloud_data || mlResult.wordcloudData || [],
      timevisData: generateTimeVisData(normalizedData),
      locationData: generateLocationData(normalizedData),
      // Include enhanced pipeline metadata
      pipelineInfo: {
        method: mlResult.clustering_method || 'enhanced_pipeline',
        enhanced: true,
        clusters: mlResult.num_clusters || 0,
        hasRichLabels: mlResult.has_rich_labels || false,
        clusterNames: mlResult.cluster_names || []
      }
    };

    console.log(`Enhanced pipeline result: ${result.pipelineInfo.method}, clusters: ${result.pipelineInfo.clusters}`);

    return result;

  } catch (error) {
    console.error('Enhanced pipeline error:', error);
    // If enhanced pipeline fails, return error - no fallback to old method
    throw new Error(`Enhanced pipeline processing failed: ${error.message}`);
  }
}

// Generate time visualization data
function generateTimeVisData(normalizedData) {
  const timevisData = [];
  if (normalizedData[0] && normalizedData[0].date) {
    normalizedData.forEach((article) => {
      if (article.date) {
        timevisData.push({
          Date: article.date,
          AnswerCount: 1,
        });
      }
    });
  }
  return timevisData;
}

// Generate location data (placeholder for future enhancement)
function generateLocationData(normalizedData) {
  // Can be enhanced with location processing
  const locations = normalizedData
    .filter(item => item.location && item.location.trim())
    .map(item => ({
      location: item.location,
      title: item.title,
      id: item.id
    }));

  return locations.length > 0 ? locations : [];
}

// Upload CSV files
router.post("/files", multerConfig.single("file"), validateFileUpload, async (req, res, next) => {
  try {
    const csv = req.file.buffer.toString("utf-8");
    const { data, errors } = Papa.parse(csv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase()
    });

    if (errors.length > 0) {
      const error = new Error("CSV parsing errors: " + errors.map(e => e.message).join(", "));
      error.status = 400;
      throw error;
    }

    if (data.length === 0) {
      const error = new Error("CSV file is empty or contains no valid data");
      error.status = 400;
      throw error;
    }

    // Normalize and process data with enhanced pipeline
    const normalizedData = normalizeData(data, 'csv');

    // Validate we have content to process
    const hasContent = normalizedData.some(item => item.content || item.title);
    if (!hasContent) {
      const error = new Error("No content or title found in the data. Please ensure your CSV has 'content' or 'title' columns.");
      error.status = 400;
      throw error;
    }

    console.log(`Processing CSV upload with ${normalizedData.length} records using enhanced pipeline`);

    // Use enhanced pipeline instead of local processing
    const result = await processDataWithEnhancedPipeline(normalizedData);

    return res.json({
      success: true,
      data: result,
      message: "Processed with enhanced phylogenetic pipeline"
    });
  } catch (error) {
    console.error('CSV upload error:', error);
    next(error);
  }
});

// Upload JSON files
router.post("/json", multerConfig.single("file"), async (req, res, next) => {
  try {
    const jsonString = req.file.buffer.toString("utf-8");
    let data;

    try {
      data = JSON.parse(jsonString);
    } catch (parseError) {
      const error = new Error("Invalid JSON format: " + parseError.message);
      error.status = 400;
      throw error;
    }

    // Ensure data is an array
    if (!Array.isArray(data)) {
      // If it's a single object, wrap it in an array
      if (typeof data === 'object' && data !== null) {
        data = [data];
      } else {
        const error = new Error("JSON must contain an array of objects or a single object");
        error.status = 400;
        throw error;
      }
    }

    if (data.length === 0) {
      const error = new Error("JSON file is empty or contains no valid data");
      error.status = 400;
      throw error;
    }

    // Normalize and process data with enhanced pipeline
    const normalizedData = normalizeData(data, 'json');

    // Validate we have content to process
    const hasContent = normalizedData.some(item => item.content || item.title);
    if (!hasContent) {
      const error = new Error("No content or title found in the data. Please ensure your JSON has 'content', 'title', or similar text fields.");
      error.status = 400;
      throw error;
    }

    console.log(`Processing JSON upload with ${normalizedData.length} records using enhanced pipeline`);

    // Use enhanced pipeline instead of local processing
    const result = await processDataWithEnhancedPipeline(normalizedData);

    return res.json({
      success: true,
      data: result,
      message: "Processed with enhanced phylogenetic pipeline"
    });
  } catch (error) {
    console.error('JSON upload error:', error);
    next(error);
  }
});

// Read Files endpoint (for testing)
router.get("/files", (req, res) => {
  return res.json({
    success: true,
    msg: "Enhanced upload endpoints ready!",
    endpoints: {
      csv: "POST /upload/files",
      json: "POST /upload/json"
    },
    requiredFields: {
      required: ["content or title"],
      optional: ["id", "date", "category", "location", "authors", "link"]
    },
    features: {
      pipeline: "Enhanced phylogenetic pipeline with intelligent clustering",
      clustering: "Automatic discovery for uncategorized data",
      labels: "Rich Newick trees with meaningful internal nodes",
      wordcloud: "Cluster-based word cloud generation"
    }
  });
});

export default router;