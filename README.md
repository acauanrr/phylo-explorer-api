# Phylo-Explorer API

Backend API service for the Phylo-Explorer application, providing NLP processing and phylogenetic tree generation for text collections.

## Features

- CSV file upload and processing
- Natural Language Processing with wink-nlp
- Phylogenetic tree construction using neighbor-joining algorithm
- **Geographic Location Extraction** - Automatic location detection and geocoding integration
- **Semantic Search with Web Integration** - Enhanced search with Wikipedia and news sources
- **ML Service Integration** - Connects to HuggingFace Space for advanced NLP operations
- Word cloud data generation
- Timeline data extraction
- RESTful API with Express.js

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run development server
npm run dev

# Run production server
npm start
```

## API Endpoints

### POST /upload/files
Upload and process a CSV file containing documents.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Body: CSV file

**Response:**
```json
{
  "success": true,
  "data": {
    "phyloNewickData": "Newick format tree",
    "wordcloudData": [{"word": "example", "qtd": 10}],
    "timevisData": [{"Date": "2024-01-01", "AnswerCount": 1}],
    "locationData": "",
    "objData": [...]
  }
}
```

### POST /api/phylo/generate-tree
Generate phylogenetic tree from text data using ML service.

**Request:**
```json
{
  "texts": ["text1", "text2", "..."],
  "labels": ["label1", "label2", "..."]
}
```

**Response:**
```json
{
  "success": true,
  "newick": "((A:0.1,B:0.2):0.05,C:0.3);",
  "metadata": {...}
}
```

### POST /api/phylo/search
Perform semantic search with location extraction and web integration.

**Request:**
```json
{
  "query": "search terms",
  "node_name": "node identifier",
  "node_type": "news|general"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "Search result title",
    "summary": "Content summary",
    "locations": [
      {
        "name": "New York",
        "type": "city",
        "confidence": 0.95
      }
    ],
    "geo_data": [
      {
        "name": "New York",
        "lat": 40.7128,
        "lon": -74.0060
      }
    ],
    "wikipedia": {
      "title": "Wikipedia article",
      "url": "https://en.wikipedia.org/wiki/..."
    },
    "web_results": [...],
    "has_location_data": true,
    "total_locations": 1,
    "total_coordinates": 1
  }
}
```

### GET /api/phylo/health
Check ML service connectivity and API health.

**Response:**
```json
{
  "status": "healthy",
  "ml_service": "connected",
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### GET /
General health check endpoint.

**Response:**
```json
{
  "success": true,
  "msg": "Sucesso! - API - Phylo-Explorer está on!"
}
```

## CSV Format Requirements

Required columns:
- `title`: Document title
- `content`: Document text content

Optional columns:
- `date`: Document date (for timeline visualization)

## Environment Variables

Create a `.env` file with:

```
PORT=6001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
MAX_FILE_SIZE=10485760
ML_SERVICE_URL=https://acauanrr-phylo-ml-service.hf.space
ML_SERVICE_LOCAL_URL=http://localhost:5000
```

**Environment Variable Details:**
- `ML_SERVICE_URL`: Production HuggingFace Space URL for ML operations
- `ML_SERVICE_LOCAL_URL`: Local ML service URL for development (optional)
- The API automatically selects between local and production ML services based on availability

## Error Handling

The API includes comprehensive error handling:
- File validation (type, size)
- CSV parsing errors
- Missing required columns
- Processing errors

## Security Features

- Helmet.js for security headers
- CORS configuration
- File size limits
- Input validation

## Development

```bash
# Run with nodemon for auto-reload
npm run dev

# Check code quality
npm run lint

# Fix linting issues
npm run lint:fix
```

## Deployment

### Heroku

```bash
heroku create phylo-explorer-api
heroku config:set NODE_ENV=production
git push heroku main
```

### Docker (Optional)

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 6001
CMD ["npm", "start"]
```

## Technologies

- **Express.js** - Web framework and API routing
- **Axios** - HTTP client for ML service integration
- **wink-nlp** - Natural Language Processing
- **neighbor-joining** - Phylogenetic tree algorithms
- **PapaParse** - CSV parsing and data processing
- **Multer** - File upload handling
- **Helmet** - Security middleware
- **CORS** - Cross-origin resource sharing
- **HuggingFace Spaces Integration** - ML service connectivity for advanced NLP operations

## License

ISC License

## Author

Acauan Ribeiro