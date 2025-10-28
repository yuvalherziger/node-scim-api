# node-scim-api Helm Chart

A minimal, production-ready Helm chart to deploy the Node.js-based SCIM API to Kubernetes.

This chart supports both local (Minikube) and remote cloud clusters (GKE/EKS/AKS).

## Prerequisites

- A working Kubernetes cluster and kubectl configured
- Helm v3
- Access to a MongoDB instance (external like Atlas, or in-cluster)

## Image

- Default image: `ghcr.io/yuvalherziger/node-scim-api:latest`

## Configuration Overview

The following table summarizes the main chart values, their defaults, and what they control. You can override any of
them via a values file (-f) or with --set. See values.yaml for the complete list and comments.

| Key                                   | Default                             | Description                                                                                                   |
|---------------------------------------|-------------------------------------|---------------------------------------------------------------------------------------------------------------|
| nameOverride                          | ""                                  | Override the chart name.                                                                                      |
| fullnameOverride                      | ""                                  | Override the fully qualified app name.                                                                        |
| scim-server.replicaCount              | 1                                   | Number of API replicas.                                                                                       |
| scim-server.port                      | 3999                                | SCIM server port (SCIM_SERVER_PORT).                                                                          |
| scim-server.baseUrl                   | ""                                  | External base URL for the API (SCIM_BASE_URL). Useful behind Ingress.                                         |
| scim-server.mongodbUri                | ""                                  | MongoDB connection string (MONGODB_URI). Not required if db.provision=true or db.externalUri is set.          |
| scim-server.dbName                    | "scim"                              | Database name (DB_NAME).                                                                                      |
| scim-server.logLevel                  | "info"                              | Application log level (LOG_LEVEL).                                                                            |
| scim-server.image.repository          | ghcr.io/yuvalherziger/node-scim-api | Container image repository.                                                                                   |
| scim-server.image.tag                 | latest                              | Image tag.                                                                                                    |
| scim-server.image.pullPolicy          | IfNotPresent                        | Image pull policy.                                                                                            |
| scim-server.resources.requests.cpu    | 50m                                 | Requested CPU for the API pod.                                                                                |
| scim-server.resources.requests.memory | 128Mi                               | Requested memory for the API pod.                                                                             |
| scim-server.resources.limits.cpu      | 500m                                | CPU limit for the API pod.                                                                                    |
| scim-server.resources.limits.memory   | 512Mi                               | Memory limit for the API pod.                                                                                 |
| service.type                          | ClusterIP                           | Kubernetes Service type (NodePort recommended for Minikube).                                                  |
| service.port                          | 3999                                | Service port.                                                                                                 |
| service.nodePort                      | null                                | Fixed NodePort when service.type=NodePort. Leave empty to auto-assign.                                        |
| secret.create                         | false                               | Whether Helm should create the Secret for sensitive env vars. For production, prefer pre-creating the Secret. |
| secret.name                           | node-scim-api-secret                | Name of the Secret that contains SCIM_BEARER_TOKEN.                                                           |
| secret.data                           | {}                                  | Key-value map of secret env vars used only when secret.create=true.                                           |
| ingress.enabled                       | false                               | Enable Kubernetes Ingress.                                                                                    |
| ingress.className                     | ""                                  | IngressClass to use.                                                                                          |
| ingress.annotations                   | {}                                  | Extra annotations for the Ingress resource.                                                                   |
| ingress.hosts[0].host                 | scim.example.com                    | Default host entry for Ingress.                                                                               |
| ingress.hosts[0].paths[0].path        | /                                   | Default path for Ingress.                                                                                     |
| ingress.hosts[0].paths[0].pathType    | Prefix                              | Default path type.                                                                                            |
| ingress.tls                           | []                                  | TLS configuration for hosts.                                                                                  |
| podAnnotations                        | {}                                  | Additional pod annotations.                                                                                   |
| podLabels                             | {}                                  | Additional pod labels.                                                                                        |
| nodeSelector                          | {}                                  | Node selector for pod scheduling.                                                                             |
| tolerations                           | []                                  | Tolerations for pod scheduling.                                                                               |
| affinity                              | {}                                  | Affinity/anti-affinity rules.                                                                                 |
| probe.liveness.enabled                | true                                | Enable liveness probe.                                                                                        |
| probe.liveness.initialDelaySeconds    | 10                                  | Liveness probe initial delay.                                                                                 |
| probe.liveness.periodSeconds          | 10                                  | Liveness probe period.                                                                                        |
| probe.readiness.enabled               | true                                | Enable readiness probe.                                                                                       |
| probe.readiness.initialDelaySeconds   | 5                                   | Readiness probe initial delay.                                                                                |
| probe.readiness.periodSeconds         | 10                                  | Readiness probe period.                                                                                       |
| db.provision                          | false                               | Provision an in-cluster MongoDB (dev/test). Not recommended for production.                                   |
| db.externalUri                        | ""                                  | External MongoDB connection string to use when not provisioning.                                              |
| db.image                              | mongodb/mongodb-atlas-local:latest  | Image for the provisioned MongoDB.                                                                            |
| db.port                               | 27017                               | MongoDB service port when provisioned.                                                                        |
| db.username                           | "scim"                              | MongoDB username for provisioned DB.                                                                          |
| db.password                           | "scim"                              | MongoDB password for provisioned DB.                                                                          |
| db.name                               | "scim"                              | MongoDB database name.                                                                                        |
| db.resources.requests.cpu             | 50m                                 | Requested CPU for provisioned MongoDB.                                                                        |
| db.resources.requests.memory          | 128Mi                               | Requested memory for provisioned MongoDB.                                                                     |
| db.resources.limits.cpu               | 500m                                | CPU limit for provisioned MongoDB.                                                                            |
| db.resources.limits.memory            | 512Mi                               | Memory limit for provisioned MongoDB.                                                                         |

## SCIM_BEARER_TOKEN Secret

The application expects a secret environment variable named `SCIM_BEARER_TOKEN`.

You can provide it in one of two ways:

1. Create the Secret separately (recommended)

    ```bash
    kubectl create secret generic node-scim-api-secret \
      --from-literal=SCIM_BEARER_TOKEN='your_token_here'
    ```

   Then install the chart with secret.create=false (default) and matching secret.name:

    ```bash
    helm install node-scim-api ./deploy/helm \
      --set secret.create=false \
      --set secret.name=node-scim-api-secret
    ```

2. Let Helm create the Secret (for testing only)

   Edit a values file or pass via --set to include the secret value:

    ```yaml
    secret:
      create: true
      name: node-scim-api-secret
      data:
        SCIM_BEARER_TOKEN: "your_token_here"
    ```

---

## Deploying on Minikube (local)

Use the provided Minikube values file, which sets service.type=NodePort and a fixed nodePort for easy host access.

1. Create a namespace:

    ```shell
    kubectl create ns scim-api
    ```

2. Prepare values and Secret

    ```bash
    cp ./deploy/helm/examples/values-minikube.yaml ./deploy/helm/values.local.yaml
    # Option A (recommended): create secret with kubectl
    kubectl create secret generic node-scim-api-secret -n scim-api \
      --from-literal=SCIM_BEARER_TOKEN='your_token_here' || true
    ```

3. Install the chart:

    ```bash
    helm install node-scim-api ./deploy/helm -f ./deploy/helm/values.local.yaml -n scim-api
    ```

4. Accessing the API from your host

- Because service.type is NodePort and a fixed service.nodePort is set, you can try direct access:

  ```bash
  # Note: This works only on some Minikube drivers (e.g., none/VM drivers).
  # On Docker/Podman/Mac/Windows drivers, NodePort on the minikube IP may not be reachable.
  MINIKUBE_IP=$(minikube ip)
  curl http://$MINIKUBE_IP:30999/healthy
  ```

- Recommended and should work across drivers—let the Minikube proxy the service or print the URL:

  ```bash
  # Replace with your namespace and the actual Service name
  # Namespace used in the examples: scim-api
  # Default Helm fullname: node-scim-api-node-scim-api
  minikube service -n scim-api node-scim-api-node-scim-api
  # or get a raw URL without opening a browser
  minikube service -n scim-api node-scim-api-node-scim-api --url
  ```

- Alternatively, you can run a network tunnel to expose NodePorts on localhost:

  ```bash
  # In a separate terminal
  minikube tunnel
  # then access via the NodePort
  curl http://$(minikube ip):30999/healthy
  ```

Notes:

- Namespace: the examples below assume `-n scim-api`. Adjust as needed.
- Service name: the Helm fullname is typically `node-scim-api-node-scim-api` when you install with
  `helm install node-scim-api ./deploy/helm`. Run `kubectl -n scim-api get svc` to confirm.
- NodePort choice: Setting a fixed nodePort makes host access predictable. You can change the port as long as it stays
  within 30000-32767.
- If you prefer, you can omit service.nodePort and let Kubernetes assign one; then use
  `minikube service -n scim-api node-scim-api-node-scim-api --url` to discover/open it.

---

## Deploying on Cloud Clusters (GKE/EKS/AKS)

Use the provided cloud values file, which keeps the Service internal (ClusterIP) and enables Ingress.

1. Prepare values and Secret

   ```bash
   # Create the Secret (recommended)
   kubectl create secret generic node-scim-api-secret \
     --from-literal=SCIM_BEARER_TOKEN='your_token_here' || true
   ```

2. Install with Ingress enabled

   ```bash
   helm install node-scim-api ./deploy/helm -f ./deploy/helm/examples/values-cloud.yaml
   ```

3. Configure DNS/TLS and base URL

    - Point your DNS (e.g., scim.example.com) to your Ingress controller.
    - Set scim-server.baseUrl to your external URL if needed.

---

## Render templates without installing

```bash
helm template node-scim-api ./deploy/helm
```

## Database Migration Job (Helm hook)

This chart includes a one-off database migration Job that runs automatically as a Helm hook:

- Hook phases: pre-install and pre-upgrade
- Job name: `{{ .Release.Name }}-scim-migration`
- Image: exactly the same as the main Deployment (`scim-server.image.repository` + `scim-server.image.tag`)
- Command override: `["npm", "run", "migrate"]`
- Environment: inherits the same ConfigMap and Secret as the main application pod, so it connects to the same database
- Pod restart policy: `Never`
- Hook annotations applied:
  - `helm.sh/hook: pre-install,pre-upgrade`
  - `helm.sh/hook-weight: "0"`
  - `helm.sh/hook-delete-policy: before-hook-creation`

Behavior when provisioning the database (db.provision=true):
- The migration Job switches to run on post-install/post-upgrade so the DB resources are created first.
- An initContainer waits for the in-cluster MongoDB Service TCP port to become reachable before running migrations.

This ensures migrations are executed at the appropriate time and wait for the database to be ready when the chart is set to provision MongoDB.

## Upgrading

```bash
helm upgrade node-scim-api ./deploy/helm -f ./deploy/helm/examples/your-values.yaml
```

## Uninstalling

```bash
helm uninstall node-scim-api
```

## Database Options

You can either bring your own MongoDB connection string or ask the chart to provision a simple in-cluster MongoDB
suitable for development/testing.

- Bring your own connection string (recommended for production):
    - Set either `scim-server.mongodbUri` or `db.externalUri`.
    - Leave `db.provision=false` (default).
- Provision in-cluster MongoDB (dev/test):
    - Set `db.provision=true`.
    - Optionally set `db.username`, `db.password`, and `db.name`.
    - The chart will automatically derive `MONGODB_URI` for the API using the internal Service DNS and the credentials
      above. You do not need to set `MONGODB_URI` yourself.
    - Note: When deriving the URI, the chart URL-encodes `db.username` and `db.password` to safely handle special
      characters. If you provide `db.externalUri` or set `scim-server.mongodbUri` directly, ensure those URIs are
      already properly encoded.

### Examples

1. External database via explicit configuration:

   ```yaml
   scim-server:
     mongodbUri: "<MONGODB CONNECTION STRING>"
     dbName: "scim"
   ```

2. External database via db.externalUri:

   ```yaml
   db:
     provision: false
     externalUri: "<MONGODB CONNECTION STRING>"
   ```

3. Provision an in-cluster MongoDB and auto-derive URI:

   ```yaml
   db:
     provision: true
     username: scim
     password: scim
     name: scim
   ```

Security note: The provisioned MongoDB uses an ephemeral volume by default (emptyDir) and is intended for
development/testing scenarios.

## Environment Variables

Non-secret application settings are configured deliberately under `.Values.scim-server` and projected via a ConfigMap as
specific environment variables. This chart does not accept arbitrary env vars.
Keys under scim-server map to env vars as follows:

- scim-server.port -> SCIM_SERVER_PORT (default 3999)
- scim-server.baseUrl -> SCIM_BASE_URL (default http://node-scim-api:3999)
- scim-server.mongodbUri -> MONGODB_URI (optional when db.provision or db.externalUri provided)
- scim-server.dbName -> DB_NAME (default scim)
- scim-server.logLevel -> LOG_LEVEL (default info)

Secret env vars (like SCIM_BEARER_TOKEN) are projected via a Secret. See the Secret section above.

## Linting

Before installing, you can lint the chart:

```bash
helm lint ./deploy/helm
```
