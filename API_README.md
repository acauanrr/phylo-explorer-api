# Phylo-Explorer API

Backend service for the Phylo-Explorer application, providing data processing, NLP analysis, and phylogenetic tree generation.

## Setup

### Prerequisites
- Node.js 18.x or higher
- npm 9.x or higher

### Installation
```bash
npm install
```

## Development

### Environment Configuration

The API uses different environment configurations:

#### Development Mode (default)
```bash
# .env or .env.development
NODE_ENV=development
PORT=6001
CORS_ORIGIN=http://localhost:3000
ML_SERVICE_URL=https://acauanrr-phylo-ml-service.hf.space
```

#### Production Mode
```bash
# .env.production
NODE_ENV=production
PORT=6001
CORS_ORIGIN=https://phylo-explorer-front-5c59fee5d5c4.herokuapp.com
ML_SERVICE_URL=https://acauanrr-phylo-ml-service.hf.space
```

### Available Scripts

#### Development Mode
```bash
npm run dev
```
- Starts the server with **nodemon** for auto-reloading
- Watches for changes in all `.js` and `.json` files
- Automatically restarts on file changes
- Uses development environment settings
- CORS configured for `http://localhost:3000`

#### Production Mode
```bash
npm start
```
- Starts the server with Node.js directly
- No auto-reloading
- Optimized for production deployment
- Uses production environment settings

### CORS Configuration

The API automatically handles CORS for multiple origins:
- `http://localhost:3000` (local development)
- `http://127.0.0.1:3000` (alternative local)
- `https://phylo-explorer-front-5c59fee5d5c4.herokuapp.com` (production)
- `https://phylo-explorer-front.herokuapp.com` (legacy production)

In development mode, all origins are allowed for easier testing.

## API Endpoints

### Main Endpoints

#### Health Check
```http
GET /
```
Returns API status

#### Upload CSV
```http
POST /upload/files
Content-Type: multipart/form-data
Body: file (CSV)
```

#### Upload JSON
```http
POST /upload/json
Content-Type: multipart/form-data
Body: file (JSON)
```

#### Generate Phylogenetic Tree
```http
POST /api/phylo/generate-tree
Content-Type: application/json
Body: {
  "texts": ["text1", "text2", ...],
  "labels": ["label1", "label2", ...]
}
```

#### Semantic Search
```http
POST /api/phylo/search
Content-Type: application/json
Body: {
  "query": "search query"
}
```

#### ML Service Health
```http
GET /api/phylo/health
```

## Data Processing

The API processes uploaded data through the following pipeline:

1. **Data Normalization**: Maps various field names to standard format
2. **NLP Processing**: Using wink-nlp for text analysis
3. **Similarity Calculation**: Cosine similarity between documents
4. **Tree Generation**: Neighbor-joining algorithm for phylogenetic trees
5. **Visualization Data**: Generates word clouds, timelines, and geographic data

## File Formats

### CSV Format
Required fields (at least one):
- `content` or `title`

Optional fields:
- `id`, `date`, `category`, `location`, `authors`, `link`

### JSON Format
Array of objects with same field structure as CSV.

## Features

- **Auto-reload in Development**: Nodemon watches for file changes
- **Flexible CORS**: Handles multiple origins automatically
- **Smart Field Mapping**: Automatically maps common field name variations
- **Error Handling**: Comprehensive error messages for debugging
- **Large File Support**: Handles files up to 10MB

## Project Structure

```
phylo-explorer-api/
├── api/
│   └── routes/
│       └── upload.routes.js    # File upload endpoints
├── src/
│   ├── routes/
│   │   └── phyloRoutes.js      # ML service integration
│   └── services/
│       └── mlService.js        # HuggingFace ML service client
├── middleware/
│   ├── errorHandler.js         # Error handling middleware
│   └── validation.js           # File validation middleware
├── utils/
│   └── clearWords.js           # Word processing utilities
├── index.js                    # Main application entry
├── dotenv.js                   # Environment configuration
├── nodemon.json               # Nodemon configuration
└── package.json               # Dependencies and scripts
```

## Deployment

### Heroku Deployment
```bash
git push heroku main
```

The API is configured to run with:
- Node.js 18.x runtime
- Automatic port binding via `process.env.PORT`
- Production environment variables

### Local Development
1. Start the API in development mode:
   ```bash
   npm run dev
   ```

2. The API will be available at:
   - http://localhost:6001

3. Frontend should be configured to use:
   - `NEXT_PUBLIC_API_URL_LOCAL=http://localhost:6001`

## Troubleshooting

### Port Already in Use
```bash
# Find process using port 6001
lsof -i :6001

# Kill the process
kill -9 <PID>
```

### CORS Issues
- Check that frontend URL is in the allowed origins list
- In development, CORS is more permissive
- Verify environment variables are loaded correctly

### File Upload Errors
- Maximum file size: 10MB
- Supported formats: CSV, JSON
- Check file encoding (UTF-8 recommended)

## Contributing

1. Use development mode for testing changes
2. Nodemon will auto-reload on file saves
3. Test with both CSV and JSON file formats
4. Ensure CORS works for your frontend URL

## License

MIT