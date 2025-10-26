# Node.js SCIM API

<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/unit.yaml"><img src="https://github.com/yuvalherziger/node-scim-api/actions/workflows/unit.yaml/badge.svg" alt="Tests"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/scim-compliance-test.yaml"><img src="https://github.com/yuvalherziger/node-scim-api/actions/workflows/scim-compliance-test.yaml/badge.svg" alt="SCIM Compliance Test"></a>

## Intro

A lightweight SCIM 2.0 server built with Express and backed by MongoDB. It exposes standard SCIM endpoints (ServiceProviderConfig, Schemas, ResourceTypes, Users, Groups, Search, Bulk, and /Me) and secures requests with a bearer token.

## Requirements

- Node.js 20+ (LTS recommended)
- MongoDB 8.0+, reachable from the server
- npm 9+
- Docker 24+ (optional, for containerized runs)

## Configuration

Configure via environment variables:

- `MONGODB_URI`: Mongo connection string (default: `mongodb://localhost:27017/?directConnection=true`)
- `DB_NAME`: Database name (default: scim)
- `SCIM_BEARER_TOKEN`: Bearer token required for all requests (no default)
- `SCIM_SERVER_PORT`: HTTP port to listen on (default: 3999)

## Build and run with Node.js

```bash
# Install deps and build
npm ci
npm run build

# Configure env
export MONGODB_URI="mongodb://localhost:27017/?directConnection=true"
export DB_NAME="scim"
export SCIM_BEARER_TOKEN="change-me"
export SCIM_SERVER_PORT=3999

# Start the server
npm start
# Or for development (auto-reload):
# npm run dev
```

Quick check:

```bash
curl -sS -H "Authorization: Bearer change-me" \
     -H "Accept: application/scim+json" \
     http://localhost:3999/ServiceProviderConfig | jq .
```

## Build and run with Docker

Build the image and run the container:
```bash
docker build -t node-scim-api .

docker run --rm \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/?directConnection=true" \
  -e DB_NAME="scim" \
  -e SCIM_BEARER_TOKEN="change-me" \
  -e SCIM_SERVER_PORT=3999 \
  -p 3999:3999 \
  node-scim-api
```

Quick check:

```bash
curl -sS -H "Authorization: Bearer change-me" \
     -H "Accept: application/scim+json" \
     http://localhost:3999/ServiceProviderConfig | jq .
```
