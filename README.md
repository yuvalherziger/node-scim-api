# Node.js SCIM API

<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/unit.yaml"><img src="https://github.com/yuvalherziger/node-scim-api/actions/workflows/unit.yaml/badge.svg" alt="Tests"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/scim-compliance-test.yaml"><img src="https://github.com/yuvalherziger/node-scim-api/actions/workflows/scim-compliance-test.yaml/badge.svg" alt="SCIM Compliance Test"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/releases"><img src="https://img.shields.io/github/v/release/yuvalherziger/node-scim-api?label=Latest&color=d914d2&logo=git&logoColor=d914d2" alt="Release"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/build-image.yml"><img src="https://img.shields.io/github/actions/workflow/status/yuvalherziger/node-scim-api/build-image.yml?logo=docker&label=Docker&color=blue" alt="Docker Image"></a>

## Intro    

A lightweight SCIM 2.0 server built with Express and backed by MongoDB.
It exposes standard SCIM endpoints (ServiceProviderConfig, Schemas, ResourceTypes, Users, Groups, Search, Bulk, and /Me)
and secures requests with a bearer token.

## Requirements

- Node.js 20+ (LTS recommended), unless running with Docker.
- MongoDB 8.0+, reachable from the server. Check out [tomodo.dev](https://tomodo.dev) for an easy way to spin up a
  MongoDB instance.
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

You can pull the image from GHCR:

```shell
docker pull ghcr.io/yuvalherziger/node-scim-api:latest
```

...and then run it:

```shell
docker run --rm \
  -e MONGODB_URI="mongodb://host.docker.internal:27017/?directConnection=true" \
  -e DB_NAME="scim" \
  -e SCIM_BEARER_TOKEN="change-me" \
  -e SCIM_SERVER_PORT=3999 \
  -p 3999:3999 \
  ghcr.io/yuvalherziger/node-scim-api:latest
```

Alternatively, you can build the image locally:

```bash
docker build -t node-scim-api .

# ... and run this image:
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

## A word of caution

This project **does not implement any MongoDB indexes**, since there are too many permutations to cover all
filtering scenarios every SCIM client might need. Covering all of them is unsustainable. However, it is strongly
recommended to create indexes for the most common queries (e.g. `userName`, `emails.value`, `meta.created`, etc.).
Avoiding index creation is a conscious decision that can have a significant negative impact on performance at scale.