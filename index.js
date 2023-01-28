import "./dotenv.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";

import uploadRoutes from "./api/routes/upload.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// eslint-disable-next-line no-undef
const PORT = process.env.PORT || 6001;

// ----- Middleware ------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(cors());
app.use(express.static("public"));

// secure express app
app.use(
  helmet({
    dnsPrefetchControl: false,
    frameguard: false,
    ieNoOpen: false,
    crossOriginResourcePolicy: false,
  })
);

// ---- ROTAS ----
// Upload
app.use("/upload", uploadRoutes);

// Index Endpoint
app.get("/", (req, res) => {
  return res.json({
    success: true,
    msg: "Sucesso! - API - Phylo-Explorer está on!",
  });
});

// Static Files (PUBLIC)
app.use(express.static(path.join(__dirname, "public")));

// server listening
app.listen(PORT, () => {
  console.log("Server running in port " + PORT);
});
