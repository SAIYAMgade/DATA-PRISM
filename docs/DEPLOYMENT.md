# DATAPRISM: Deployment Guide

## 1. Local Development
- **Backend:**
  ```powershell
  .\.venv\Scripts\uvicorn apps.api.app.main:app --reload --port 8000
  ```
- **Frontend:**
  ```powershell
  cd apps/web
  npm install
  npm run dev
  ```

## 2. Production Monolith Deployment
- **Containerization:** Pre-configured `Dockerfile` building a lightweight multi-stage image.
- **Reverse Proxy:** Nginx or Caddy routing `/api/v1` to uvicorn and static assets to `/usr/share/nginx/html`.
- **Environment Variables:** Documented in `.env.example`.
