# Node.js SCIM API

<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/unit.yaml"><img src="https://github.com/yuvalherziger/node-scim-api/actions/workflows/unit.yaml/badge.svg" alt="Tests"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/scim-compliance-test.yaml"><img src="https://github.com/yuvalherziger/node-scim-api/actions/workflows/scim-compliance-test.yaml/badge.svg" alt="SCIM Compliance Test"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/releases"><img src="https://img.shields.io/github/v/release/yuvalherziger/node-scim-api?label=Latest&color=d914d2&logo=git&logoColor=d914d2" alt="Release"></a>
<a href="https://github.com/yuvalherziger/node-scim-api/actions/workflows/build-image.yml"><img src="https://img.shields.io/github/actions/workflow/status/yuvalherziger/node-scim-api/build-image.yml?logo=docker&label=Docker&color=blue" alt="Docker Image"></a>
<img alt="GitHub Actions Workflow Status" src="https://img.shields.io/github/actions/workflow/status/yuvalherziger/node-scim-api/publish-helm-chart.yaml?logo=helm&label=Helm%20Chart&color=purple&link=https%3A%2F%2Fgithub.com%2Fyuvalherziger%2Fnode-scim-api%2Ftree%2Fmain%2Fdeploy%2Fhelm">

## Intro    

A lightweight SCIM 2.0 server built with Express and backed by MongoDB.
It exposes standard SCIM endpoints (ServiceProviderConfig, Schemas, ResourceTypes, Users, Groups, Search, Bulk, and /Me)
and secures requests with a bearer token.

## Key features

- SCIM compliance with the core schemas
- SCIM compliance with the enterprise schemas for prominent clients (e.g., Microsoft Entra ID)

## Deployment options

Two recommended ways to deploy this SCIM API:

- [Helm chart](./deploy/helm/README.md).
- [Bare Kubernetes resources](./deploy/kubernetes/README.md) (in development).

## Compliance

In addition to the automated compliance test as part of this tool's CI pipeline, the tool is
tested against [Microsoft Entra ID SCIM Validator](https://scimvalidator.microsoft.com/) 
with every release, to ensure de facto compliance with enterprise SCIM provisioners:

<img width="572" height="580" alt="Screenshot 2025-10-28 at 11 13 55" src="https://github.com/user-attachments/assets/e41fc922-3b29-413d-9dda-35854330fb3f" />

## Development

### Requirements

- Node.js 20+ (LTS recommended), unless running with Docker.
- MongoDB 8.0+, reachable from the server. Check out [tomodo.dev](https://tomodo.dev) for an easy way to spin up a
  local MongoDB instance.
- Docker 24+ (optional, if you prefer running the API in a container)

### Configuration

Configure via environment variables:

- `MONGODB_URI`: Mongo connection string (default: `mongodb://localhost:27017/?directConnection=true`)
- `DB_NAME`: Database name (default: scim)
- `SCIM_BEARER_TOKEN`: Bearer token required for all requests (no default)
- `SCIM_SERVER_PORT`: HTTP port to listen on (default: 3999)

### Build and run with Node.js

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

### Build and run with Docker

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

## A note on MongoDB indexes

This project implements the required indexes for its default namespaces:

- `scim.users`
- `scim.groups`

If, for any reason, you change the default database (`scim`), you will need to account for indexes in your `users`
and `groups` collections.

Please also note that different SCIM clients may use different query filters. Prominent SCIM clients like
**Azure Entra ID** only filter by `userName` and `externalId` for users, and `displayName` for groups.
If your SCIM client uses different filters, it's highly recommended that you create indexes for those fields.
