FROM node:20-bookworm-slim AS client-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build


FROM python:3.12-slim AS runtime

ENV NODE_ENV=production \
    PORT=4000 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system galera \
    && adduser --system --ingroup galera --home /app galera

COPY server_py/requirements.txt /app/server_py/requirements.txt
RUN pip install --no-cache-dir -r /app/server_py/requirements.txt

COPY --chown=galera:galera server_py/ /app/server_py/
COPY --chown=galera:galera --from=client-builder /app/client/dist /app/client/dist

RUN mkdir -p /app/data \
    && chown -R galera:galera /app

USER galera

EXPOSE 4000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://127.0.0.1:{os.environ.get(\"PORT\", \"4000\")}/api/health', timeout=3).read()"

CMD ["sh", "-c", "python -m uvicorn app.main:app --app-dir server_py --host 0.0.0.0 --port ${PORT:-4000}"]
