# Docker Compose deployment

Local testing only. This folder provides a minimal Docker Compose setup to run the SCIM API
together with an internal MongoDB community standalone instance.

## Prerequisites

- Docker and Docker Compose plugin installed

## How to run

Choose one of the following options.

### Option A: Run as-is (defaults)

1. Start the stack:
   ```bash
   docker compose up -d --build
   ```
2. Health check:

3. ```bash
   curl http://localhost:3999/healthy
   # {"healthy":true}
   ```

4. Example request (default token is "change-me" — update it before sharing access):

   ```bash
   curl -H "Authorization: Bearer change-me" \
        -H "Content-Type: application/scim+json" \
        http://localhost:3999/ServiceProviderConfig
   ```

### Option B: Make a copy and customize configuration

1. Copy the `docker-compose.yaml` file:

   ```bash
   cp docker-compose.yaml docker-compose.local.yaml
   ```

2. Edit `docker-compose.local.yaml` and adjust the literal values under services.api.environment:

   - `SCIM_BEARER_TOKEN` (required)
   - `SCIM_SERVER_PORT` (default 3999)
   - `LOG_LEVEL` (default info)
   - `DB_NAME` (default scim)
   - `SCIM_BASE_URL` (default http://localhost:3999)
   - `MONGODB_URI` is fixed to the internal "mongo" service for local testing

3. Run your customized file:

   ```bash
   docker compose -f docker-compose.local.yaml up -d --build
   ```

## Services

- `api`: Builds from the repository root Dockerfile and listens on 3999 (published to host 3999).
- `mongo`: MongoDB Community Server 8.0, internal-only (no host port), data persisted in a named volume.

## Configuration notes

- This docker-compose deployment locks the API to the internal MongoDB at mongodb://mongo:27017/?directConnection=true
- External/host MongoDB is intentionally not supported in this deployment.
  Use the [Helm deployment](../helm/README.md) for production-ready scenarios.
- The API is configured with environment variables from the file.
- Default literals inside the file:
  - `SCIM_BEARER_TOKEN`: "change-me"
  - `SCIM_SERVER_PORT`: "3999" (container port is 3999)
  - `LOG_LEVEL`: "info"
  - `DB_NAME`: "scim"
  - `SCIM_BASE_URL`: "http://localhost:3999"
