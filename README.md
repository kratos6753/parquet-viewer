# Parquet Viewer

A self-contained web application for uploading, exploring, and downloading Apache Parquet files — no installation, no login, no configuration required. Pull the Docker image, run one command, and open your browser.

---

## Features

- **Upload** `.parquet` files up to **200 MB** via click or drag-and-drop, with a live upload progress bar
- **Schema panel** — collapsible view of all column names and their types, colour-coded by category (integer, float, string, boolean, date/time, binary)
- **Paginated table** — configurable rows per page (25 / 50 / 100 / 200 / 500), sticky header, alternating row colours, row numbers, and smart ellipsis pagination
- **Download** the current page or the entire dataset in either **CSV** or **Parquet** format
- **No login or sign-up** — files are identified by a UUID generated at upload time and automatically cleaned up after 24 hours

---

## Quick Start (Docker Hub)

Once the image is published, anyone can run it with a single command:

```bash
docker run -p 8080:8080 <dockerhub-username>/parquet-viewer:latest
```

Then open **http://localhost:8080** in your browser.

To run in the background:

```bash
docker run -d -p 8080:8080 --name parquet-viewer <dockerhub-username>/parquet-viewer:latest
```

To stop:

```bash
docker stop parquet-viewer
docker rm parquet-viewer
```

> **Port conflict?** Map to a different host port, e.g. `-p 9090:8080` and open http://localhost:9090.

---

## Build from Source

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) 20+

### Clone and build

```bash
git clone <repo-url>
cd parquet-viewer
docker build -t parquet-viewer:latest .
```

The build uses a **multi-stage Dockerfile**:

1. **Stage 1 — Node 20 Alpine**: installs npm dependencies and produces a production Vite build of the React frontend.
2. **Stage 2 — Python 3.12 Slim**: installs FastAPI + pandas + pyarrow, copies the React build into the nginx webroot, and sets up supervisord to manage both nginx and uvicorn.

### Run the locally built image

```bash
docker run -p 8080:8080 parquet-viewer:latest
```

---

## Publishing to Docker Hub

```bash
# Tag
docker tag parquet-viewer:latest <your-dockerhub-username>/parquet-viewer:latest

# (Optional) also tag a version
docker tag parquet-viewer:latest <your-dockerhub-username>/parquet-viewer:1.0.0

# Push
docker push <your-dockerhub-username>/parquet-viewer:latest
docker push <your-dockerhub-username>/parquet-viewer:1.0.0
```

---

## Architecture

```
┌─────────────────────────────────────────┐
│            Docker Container             │
│                                         │
│  ┌────────────┐    /api/*   ┌─────────┐ │
│  │   nginx    │ ──────────► │ uvicorn │ │
│  │  :8080     │             │  :8000  │ │
│  │            │ ◄────────── │ FastAPI │ │
│  │  /         │             └─────────┘ │
│  │  React SPA │                         │
│  └────────────┘                         │
│                                         │
│  supervisord manages both processes     │
└─────────────────────────────────────────┘
```

| Component | Technology |
|-----------|------------|
| Frontend | React 18, Vite 5, Tailwind CSS 3 |
| Backend | FastAPI, uvicorn |
| Parquet I/O | PyArrow 18, pandas 2 |
| Reverse proxy / static files | nginx |
| Process manager | supervisord |
| Container base | python:3.12-slim |

---

## Project Structure

```
parquet-viewer/
├── Dockerfile
├── .dockerignore
├── supervisord.conf          # Manages nginx + uvicorn
├── nginx/
│   └── nginx.conf            # Listens on :8080, proxies /api/* to :8000
├── backend/
│   ├── main.py               # FastAPI application
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        └── components/
            ├── FileUpload.jsx    # Drag-and-drop upload with XHR progress
            ├── DataTable.jsx     # Paginated table + download toolbar
            └── Pagination.jsx    # Smart ellipsis pagination
```

---

## API Reference

All endpoints are served at `/api/`.

### `POST /api/upload`

Upload a Parquet file.

**Request** — `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | A `.parquet` file, max 200 MB |

**Response `200`**

```json
{
  "file_id": "uuid-string",
  "filename": "sales_data.parquet",
  "row_count": 500000,
  "col_count": 12,
  "columns": [
    { "name": "id",    "type": "int64"  },
    { "name": "name",  "type": "string" },
    { "name": "score", "type": "double" }
  ]
}
```

**Error responses**

| Status | Reason |
|--------|--------|
| 400 | File is not a `.parquet` file |
| 413 | File exceeds 200 MB |
| 422 | File is not a valid Parquet file |

---

### `GET /api/data/{file_id}`

Fetch a page of rows.

**Query parameters**

| Param | Default | Description |
|-------|---------|-------------|
| `page` | `1` | Page number (1-based) |
| `page_size` | `100` | Rows per page (1–1000) |

**Response `200`**

```json
{
  "data": [ { "col1": 1, "col2": "foo" }, ... ],
  "page": 1,
  "page_size": 100,
  "total_rows": 500000,
  "total_pages": 5000,
  "start_row": 1,
  "end_row": 100
}
```

---

### `GET /api/download/{file_id}`

Download data as CSV or Parquet.

**Query parameters**

| Param | Values | Description |
|-------|--------|-------------|
| `scope` | `page` \| `all` | Download only the current page or the entire dataset |
| `format` | `csv` \| `parquet` | Output format |
| `page` | integer | Current page (used when `scope=page`) |
| `page_size` | integer | Page size (used when `scope=page`) |

Returns a file download with an appropriate `Content-Disposition` header.

---

## Local Development (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts on **http://localhost:5173** and proxies all `/api/*` requests to `http://localhost:8000`, so both services work together without any CORS configuration.

---

## Notes

- Uploaded files are stored in `/tmp/parquet_viewer/` inside the container and are **automatically deleted after 24 hours**. Data does not persist across container restarts.
- The in-memory table cache is keyed by UUID, so each uploaded file is isolated to whoever holds that UUID.
- For very wide tables (many columns), the table body scrolls horizontally.
- Cell values longer than 60 characters are truncated in the display; hover over a cell to see the full value in a tooltip.
- Nested types (lists, structs, maps) are rendered as compact JSON strings in the table.
