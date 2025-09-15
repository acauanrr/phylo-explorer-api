import "./dotenv.js";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import morgan from "morgan";
import helmet from "helmet";
import cors from "cors";

import uploadRoutes from "./api/routes/upload.routes.js";
import phyloRoutes from "./src/routes/phyloRoutes.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 6001;
const NODE_ENV = process.env.NODE_ENV || "development";

// ----- Middleware ------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan(NODE_ENV === "production" ? "combined" : "dev"));

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'https://phylo-explorer-front-5c59fee5d5c4.herokuapp.com',
  'https://phylo-explorer-front.herokuapp.com'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list or if we're in development mode
    if (allowedOrigins.indexOf(origin) !== -1 || NODE_ENV === 'development') {
      callback(null, true);
    } else if (process.env.CORS_ORIGIN === '*') {
      // Allow all origins if explicitly set
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

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

// Phylo ML Routes
app.use("/api/phylo", phyloRoutes);

// Index Endpoint
app.get("/", (req, res) => {
  return res.json({
    success: true,
    msg: "Sucesso! - API - Phylo-Explorer está on!",
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Server listening
app.listen(PORT, () => {
  console.log(`🚀 Server running in ${NODE_ENV} mode on port ${PORT}`);
});
