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

// Upload files
router.post("/files", multerConfig.single("file"), async (req, res) => {
  const csv = req.file.buffer.toString("utf-8");
  var { data } = Papa.parse(csv, {
    header: true,
  });
  data.splice(-1); // remove ultima linha - devido a primeira ser o cabeçalho
  console.log(data);
  console.log(data.length);

  // -----------------------------------------------------  1° - Criar matriz de distâncias
  // https://winkjs.org/wink-nlp/getting-started.html

  // ####   Similarity   ####
  let distance_matrix = [];
  let line_simi = [];
  let docA, bowA, docB, bowB, simi;

  // Isso aqui tem que melhorar -> O(n^2)
  for (let i = 0; i < data.length; i++) {
    docA = nlp.readDoc(data[i].content);
    bowA = docA.tokens().out(its.value, as.bow);
    for (let j = 0; j < data.length; j++) {
      docB = nlp.readDoc(data[j].content);
      bowB = docB.tokens().out(its.value, as.bow);
      simi = i != j ? similarity.bow.cosine(bowA, bowB) : 0;
      line_simi.push(simi);
    }
    distance_matrix.push(line_simi);
  }

  // -----------------------------------------------------  2° - Make NJ Tree
  let taxa = [];
  data.map((d) =>
    taxa.push({
      name: d.title,
    })
  );
  console.log(taxa);

  var RNJ = new RapidNeighborJoining(distance_matrix, taxa);
  RNJ.run();
  //var phyloObjData = RNJ.getAsObject();
  var phyloNewickData = RNJ.getAsNewick();

  return res.json({
    objData: data,
    phyloNewickData,
    wordcloudData: "",
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
