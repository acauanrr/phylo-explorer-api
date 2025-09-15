import { Router } from "express";
import Papa from "papaparse";
import { multerConfig, validateFileUpload } from "../../middleware/validation.js";

const router = new Router();

// NLP Setup
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";
import similarity from "wink-nlp/utilities/similarity.js";

const nlp = winkNLP(model);
const its = nlp.its;
const as = nlp.as;

// Neighbor-joining
import { RapidNeighborJoining } from "neighbor-joining";
import { makeWords } from "../../utils/clearWords.js";

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

// Process data and generate visualizations
function processData(normalizedData) {
  // -----------------------------------------------------  1° - Create distance matrix
  let distance_matrix = [];
  let line_simi = [];
  let docA, bowA, docB, bowB, simi;
  let sortable = [];

  for (let i = 0; i < normalizedData.length; i++) {
    const contentA = normalizedData[i].content || normalizedData[i].title || "";
    docA = nlp.readDoc(contentA);

    // Create tokens, filter only words and remove stop words
    bowA = docA
      .tokens()
      .filter((t) => t.out(its.type) === "word" && !t.out(its.stopWordFlag))
      .out(its.normal, as.bow);

    // Wordcloud part
    let newA = JSON.parse(JSON.stringify(bowA));
    for (var elem in newA) {
      sortable.push({ word: elem, qtd: newA[elem] });
    }

    line_simi = [];
    for (let j = 0; j < normalizedData.length; j++) {
      const contentB = normalizedData[j].content || normalizedData[j].title || "";
      docB = nlp.readDoc(contentB);
      bowB = docB
        .tokens()
        .filter((t) => t.out(its.type) === "word" && !t.out(its.stopWordFlag))
        .out(its.normal, as.bow);
      simi = i != j ? similarity.bow.cosine(bowA, bowB) : 0;
      line_simi.push(simi);
    }
    distance_matrix.push(line_simi);
  }

  // Wordcloud processing
  var listOfWords = [];
  sortable.reduce(function (ress, value) {
    if (!ress[value.word]) {
      ress[value.word] = { word: value.word, qtd: 0 };
      listOfWords.push(ress[value.word]);
    }
    ress[value.word].qtd += value.qtd;
    return ress;
  }, {});

  listOfWords.sort(function (a, b) {
    return b.qtd - a.qtd;
  });

  // Return WordCloud List
  const wordcloudData = makeWords(listOfWords, 100);

  // -----------------------------------------------------  2° - Make NJ Tree
  let taxa = [];
  normalizedData.forEach((d) =>
    taxa.push({
      name: d.title || "Untitled",
    })
  );

  var RNJ = new RapidNeighborJoining(distance_matrix, taxa);
  RNJ.run();
  var phyloNewickData = RNJ.getAsNewick();

  // -------- Make TimeVis Data
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

  return {
    objData: normalizedData,
    phyloNewickData,
    wordcloudData,
    timevisData,
    locationData: "", // Can be enhanced with location processing
  };
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

    // Normalize and process data
    const normalizedData = normalizeData(data, 'csv');

    // Validate we have content to process
    const hasContent = normalizedData.some(item => item.content || item.title);
    if (!hasContent) {
      const error = new Error("No content or title found in the data. Please ensure your CSV has 'content' or 'title' columns.");
      error.status = 400;
      throw error;
    }

    const result = processData(normalizedData);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
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

    // Normalize and process data
    const normalizedData = normalizeData(data, 'json');

    // Validate we have content to process
    const hasContent = normalizedData.some(item => item.content || item.title);
    if (!hasContent) {
      const error = new Error("No content or title found in the data. Please ensure your JSON has 'content', 'title', or similar text fields.");
      error.status = 400;
      throw error;
    }

    const result = processData(normalizedData);

    return res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Read Files endpoint (for testing)
router.get("/files", (req, res) => {
  return res.json({
    success: true,
    msg: "Upload endpoints ready!",
    endpoints: {
      csv: "POST /upload/files",
      json: "POST /upload/json"
    },
    requiredFields: {
      required: ["content or title"],
      optional: ["id", "date", "category", "location", "authors", "link"]
    }
  });
});

export default router;