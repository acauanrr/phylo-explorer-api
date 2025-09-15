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

// Upload files
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

    // Validate required columns
    const requiredColumns = ["content", "title"];
    const headers = Object.keys(data[0] || {});
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));

    if (missingColumns.length > 0) {
      const error = new Error(`Missing required columns: ${missingColumns.join(", ")}`);
      error.status = 400;
      throw error;
    }

    // -----------------------------------------------------  1° - Criar matriz de distâncias
    // https://winkjs.org/wink-nlp/getting-started.html

    // ####   Similarity   ####
    let distance_matrix = [];
    let line_simi = [];
    let docA, bowA, docB, bowB, simi;

    let sortable = [];

    for (let i = 0; i < data.length; i++) {
      docA = nlp.readDoc(data[i].content || "");
      // Cria tokens, filtra só palavra e remove stop words e cria bg of words
      bowA = docA
        .tokens()
        .filter((t) => t.out(its.type) === "word" && !t.out(its.stopWordFlag))
        .out(its.normal, as.bow); //its.value

      // Wordcloud part
      let newA = JSON.parse(JSON.stringify(bowA));

      for (var elem in newA) {
        sortable.push({ word: elem, qtd: newA[elem] });
      }
      line_simi = [];
      for (let j = 0; j < data.length; j++) {
        docB = nlp.readDoc(data[j].content || "");
        bowB = docB
          .tokens()
          .filter((t) => t.out(its.type) === "word" && !t.out(its.stopWordFlag))
          .out(its.normal, as.bow); //its.value
        simi = i != j ? similarity.bow.cosine(bowA, bowB) : 0;
        line_simi.push(simi);
      }
      distance_matrix.push(line_simi);
    }
    // Wordcloud part
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

    // Retorno WordCloud List
    const wordcloudData = makeWords(listOfWords, 100);

    // -----------------------------------------------------  2° - Make NJ Tree
    let taxa = [];
    data.forEach((d) =>
      taxa.push({
        name: d.title || "Untitled",
      })
    );

    var RNJ = new RapidNeighborJoining(distance_matrix, taxa);
    RNJ.run();
    //var phyloObjData = RNJ.getAsObject();
    var phyloNewickData = RNJ.getAsNewick();

    // -------- Make DataVis
    const timevisData = [];
    if (data[0] && data[0].date) {
      data.forEach((article) =>
        timevisData.push({
          Date: article.date,
          AnswerCount: 1,
        })
      );
    }

    return res.json({
      success: true,
      data: {
        objData: data,
        phyloNewickData,
        wordcloudData,
        timevisData,
        locationData: "",
      }
    });
  } catch (error) {
    next(error);
  }
});

// Read Files
router.get("/files", (req, res) => {
  return res.json({
    success: true,
    msg: "Files OK!",
  });
});

export default router;
