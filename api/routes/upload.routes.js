// https://sebhastian.com/javascript-csv-to-array/
import { Router } from "express";
import multer from "multer";
import Papa from "papaparse";

const multerConfig = multer();
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
router.post("/files", multerConfig.single("file"), async (req, res) => {
  const csv = req.file.buffer.toString("utf-8");
  var { data } = Papa.parse(csv, {
    header: true,
  });
  data.splice(-1); // remove ultima linha - devido a primeira ser o cabeçalho

  // -----------------------------------------------------  1° - Criar matriz de distâncias
  // https://winkjs.org/wink-nlp/getting-started.html

  // ####   Similarity   ####
  let distance_matrix = [];
  let line_simi = [];
  let docA, bowA, docB, bowB, simi;

  let sortable = [];

  for (let i = 0; i < data.length; i++) {
    docA = nlp.readDoc(data[i].content);
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
    for (let j = 0; j < data.length; j++) {
      docB = nlp.readDoc(data[j].content);
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
  data.map((d) =>
    taxa.push({
      name: d.title,
    })
  );

  var RNJ = new RapidNeighborJoining(distance_matrix, taxa);
  RNJ.run();
  //var phyloObjData = RNJ.getAsObject();
  var phyloNewickData = RNJ.getAsNewick();

  return res.json({
    objData: data,
    phyloNewickData,
    wordcloudData,
    timevisData: "",
    locationData: "",
  });
});

// Read Files
router.get("/files", (req, res) => {
  return res.json({
    success: true,
    msg: "Files OK!",
  });
});

export default router;
