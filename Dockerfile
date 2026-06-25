FROM node:20-alpine AS react-builder
WORKDIR /app
COPY react-src/ ./src/
COPY package.json ./
RUN npm install && npm run build

FROM python:3.11-slim
WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .
COPY --from=react-builder /app/build ./react-build

ENV PORT=8080
EXPOSE 8080

CMD ["gunicorn", "server:app", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120"]
