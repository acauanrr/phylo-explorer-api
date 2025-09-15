# Phylo-Explorer API

Backend API service for the Phylo-Explorer application, providing NLP processing and phylogenetic tree generation for text collections.

## Features

- CSV file upload and processing
- Natural Language Processing with wink-nlp
- Phylogenetic tree construction using neighbor-joining algorithm
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

### GET /
Health check endpoint.

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
```

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

- Express.js - Web framework
- wink-nlp - NLP processing
- neighbor-joining - Phylogenetic trees
- PapaParse - CSV parsing
- Multer - File uploads

## License

ISC License

## Author

Acauan Ribeiro