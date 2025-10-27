# Kubernetes Deployment for Node SCIM API

This folder contains minimal, production-ready Kubernetes manifests for deploying the Node.js-based SCIM API.

## Contents

- `deployment.yaml` — Deployment for the app
- `service.yaml` — Service (ClusterIP by default; NodePort for Minikube)
- `configmap.yaml` — Non-sensitive configuration
- `secret.yaml` — Secret with the SCIM bearer token
- `ingress.yaml` — Optional Ingress (fully commented)

## Prerequisites
- kubectl installed and configured to point to your cluster
- For local testing: Minikube installed
- A reachable MongoDB instance (e.g., MongoDB Atlas or a MongoDB Service inside the cluster)

## Environment variables used by the app

- `SCIM_BEARER_TOKEN` (Secret)
- `SCIM_SERVER_PORT` (default `3999`)
- `SCIM_BASE_URL` (default `http://node-scim-api:3999`)
- `MONGODB_URI` (provide your MongoDB connection string)
- `DB_NAME` (default `scim`)
- `LOG_LEVEL` (default `info`)

## Quick start

1. Create the Secret with the bearer token
   Replace the placeholder value with your real token. You can either edit `secret.yaml` and apply, or create the Secret directly with kubectl (recommended):

   ```bash
   kubectl create secret generic node-scim-api-secret \
     --from-literal=SCIM_BEARER_TOKEN='your_token_here'
   ```

2. Configure non-sensitive values (optional)
   - Edit `configmap.yaml` to point `MONGODB_URI` to your MongoDB. The default value assumes a Service named "mongo" in the same namespace.
   - Adjust `SCIM_BASE_URL` if you plan to expose the service externally (e.g., via Ingress) or have a different host.

3. Apply all manifests
   Run this in the current directory:

   ```bash
   kubectl apply -f .
   ```

4. Check rollout and logs

   ```bash
   kubectl rollout status deploy/node-scim-api
   kubectl logs deploy/node-scim-api -f
   ```

## Local testing with Minikube

### Option A: Use NodePort

- Edit `service.yaml` and set: `spec.type: NodePort`
- Optionally set a `nodePort` (e.g., `30999`) within your cluster's NodePort range
- Apply the change, then open the service:

```bash
minikube service node-scim-api
```

### Option B: Use Ingress
- Enable the Minikube Ingress addon:

```bash
minikube addons enable ingress
```

- Uncomment and customize `ingress.yaml` (host, TLS, etc.)
- Update `SCIM_BASE_URL` in the ConfigMap to match your chosen host (e.g., `https://scim.local.test`)
- Re-apply manifests

## Remote Kubernetes clusters (GKE/EKS/AKS)
- Keep the Service as ClusterIP and front it with your cloud Ingress Controller or Gateway
- Set `SCIM_BASE_URL` to the external URL you will use
- Ensure connectivity from the cluster to your MongoDB (VPC peering, allow-listing, or in-cluster MongoDB)

## Namespaces
- Manifests default to the `default` namespace
- If you use another namespace, create it first and apply with `-n <your-namespace>`

## Uninstall

```bash
kubectl delete -f .
```

## Notes
- Image used: `ghcr.io/yuvalherziger/node-scim-api:latest`
- `imagePullPolicy` is `IfNotPresent`; adjust if you need `Always`
- Deployment includes basic resource requests/limits; tune for your workloads
