# Documents RAG - AI Document Management System

A private AI-powered Document Management and Retrieval-Augmented Generation (RAG) platform. Upload documents, organize them into categories, generate embeddings, and chat with your documents using AI.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Vector DB | Qdrant |
| Storage | Local filesystem (R2-ready interface) |
| AI | OpenAI Embeddings + Chat Completion |

## Prerequisites

- Node.js 18+
- Docker (for Qdrant)
- MongoDB Atlas connection string
- OpenAI API key

## Quick Start

### 1. Start Qdrant

```bash
docker compose up -d
```

Qdrant will be available at `http://localhost:6333`.

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your MongoDB Atlas MONGO_URI, JWT_SECRET, and OPENAI_API_KEY
npm install
npm run dev
```

Backend runs at `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

## Troubleshooting

### `querySrv ECONNREFUSED` (MongoDB Atlas)

Node.js on Windows sometimes cannot resolve `mongodb+srv://` URIs even when `nslookup` works.

Use the **standard seedlist connection string** from MongoDB Atlas instead:

1. Atlas -> Connect -> Drivers
2. Copy the `mongodb://...` URI (not `mongodb+srv://`)
3. Include all three shard hosts and the `replicaSet` option so writes route to the primary
4. Update `MONGO_URI` in `backend/.env`

If you connect directly to one shard with `directConnection=true`, writes can fail with `NotWritablePrimary` when that shard is not the current primary.

### Docker / Qdrant errors

If you see `failed to connect to the docker API`:

1. Open **Docker Desktop** and wait until it shows "Running"
2. Run `docker compose up -d`
3. Restart the backend

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for JWT token signing |
| `OPENAI_API_KEY` | OpenAI API key |
| `QDRANT_URL` | Qdrant server URL (default: `http://localhost:6333`) |
| `QDRANT_COLLECTION` | Qdrant collection name |
| `UPLOAD_DIR` | Local upload directory |
| `FRONTEND_URL` | Frontend URL for CORS |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API URL (default: `http://localhost:5000/api`) |

## Features

- **Authentication** - Register, login, JWT-protected routes
- **Document Upload** - PDF, DOCX, TXT, and images (OCR pending)
- **Categories** - 8 predefined + custom categories
- **Processing Pipeline** - Text extraction, chunking, embedding, vector storage
- **Search** - Keyword, semantic, and hybrid search with filters
- **AI Chat** - Ask questions, get answers with source citations
- **Document Viewer** - PDF preview, download, metadata, related documents

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create custom category |
| POST | `/api/documents/upload` | Upload document |
| GET | `/api/documents` | List documents (with filters) |
| GET | `/api/documents/:id` | Get document details |
| GET | `/api/search?q=...` | Search documents |
| POST | `/api/chat` | Ask AI question |
| GET | `/api/chat/history` | Get chat history |

## Architecture

```
User → React Frontend → Express API → MongoDB (metadata + chunks)
                                    → Qdrant (vectors)
                                    → Local Storage (files)
                                    → OpenAI (embeddings + chat)
```

The storage layer uses a service interface, making it straightforward to swap local storage for Cloudflare R2 in production.

## MVP Limitations

- Image uploads are stored but OCR extraction is not yet implemented
- Local file storage is active; R2 integration is interface-ready
- User-scoped access only (no team/company RBAC yet)

## Future Phases

Accounting, ledgers, bank statements, invoices, projects, clients, dashboard analytics, and AI CFO assistant modules are planned for future ERP phases.
