# ── Stage 1: build the React frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend
COPY frontend/package.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ── Stage 2: runtime image ─────────────────────────────────────────────────
FROM python:3.12-slim

# System deps: nginx + supervisor
RUN apt-get update \
    && apt-get install -y --no-install-recommends nginx supervisor \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /var/log/supervisor /tmp/parquet_viewer

# Python deps
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Backend source
COPY backend/ /app/backend/

# React build output
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html

# Nginx config (replaces default)
COPY nginx/nginx.conf /etc/nginx/sites-available/default
RUN rm -f /etc/nginx/sites-enabled/default \
    && ln -s /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Supervisor config (full replacement so nodaemon=true takes effect)
COPY supervisord.conf /etc/supervisor/supervisord.conf

EXPOSE 8080

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
