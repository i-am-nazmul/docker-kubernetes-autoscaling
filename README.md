# Kubernetes Horizontal Pod Autoscaling (HPA) with Node.js & Docker

A hands-on demonstration of containerization and **Horizontal Pod Autoscaling (HPA)** in Kubernetes using a lightweight Node.js Express application running on Minikube.

The application includes a CPU-intensive `/load` endpoint designed to generate real CPU load, triggering Kubernetes to automatically scale the deployment up to a maximum of 3 replicas and scale back down when traffic subsides.

---

## 📋 Table of Contents
- [Architecture Overview](#-architecture-overview)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Quick Start Guide](#-quick-start-guide)
  - [1. Start Minikube & Enable Metrics Server](#1-start-minikube--enable-metrics-server)
  - [2. Build the Docker Image](#2-build-the-docker-image)
  - [3. Deploy Kubernetes Manifests](#3-deploy-kubernetes-manifests)
  - [4. Verify Deployment & HPA](#4-verify-deployment--hpa)
- [Testing Autoscaling under Load](#-testing-autoscaling-under-load)
  - [1. Expose the Service](#1-expose-the-service)
  - [2. Monitor Autoscaling in Real-Time](#2-monitor-autoscaling-in-real-time)
  - [3. Generate Traffic / High Load](#3-generate-traffic--high-load)
  - [4. Observe Scale-Down (Cooldown)](#4-observe-scale-down-cooldown)
- [Kubernetes Configuration Reference](#-kubernetes-configuration-reference)
- [Cleanup](#-cleanup)

---

## 🏛️ Architecture Overview

```
                          ┌────────────────────────┐
                          │     Metrics Server     │
                          └───────────┬────────────┘
                                      │ (CPU Metrics)
                                      ▼
┌─────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐
│   HTTP Client   │──────▶│    NodePort Service    │──────▶│   node-app Pod(s)      │
│  (curl / load)  │       │     (Port 3000)        │       │   (1 to 3 Replicas)    │
└─────────────────┘       └────────────────────────┘       └───────────▲────────────┘
                                                                       │
                                  ┌────────────────────────┐           │
                                  │   HPA (CPU Target 50%) ├───────────┘
                                  └────────────────────────┘
```

- **Node.js Express Service**:
  - `GET /health` — Health check endpoint returning status 200.
  - `GET /load` — Simulates CPU-heavy calculations (randomized computation loop) to elevate CPU usage.
- **Horizontal Pod Autoscaler (HPA)**:
  - Continuously samples CPU metrics via Kubernetes Metrics Server.
  - Target threshold: **50% average CPU utilization** relative to requested resources (`50m`).
  - Min Replicas: **1**, Max Replicas: **3**.

---

## 📁 Project Structure

```text
├── .dockerignore        # Docker build ignore rules
├── .gitignore           # Git ignore rules (node_modules, logs)
├── Dockerfile           # Multi-stage/lean Node.js 20 Alpine image
├── package.json         # Node.js dependencies (Express)
├── package-lock.json    # Exact dependency lockfile
├── server.js            # Express application with /health and /load routes
├── deployment.yaml      # Kubernetes Deployment with CPU/Memory limits & requests
├── service.yaml         # Kubernetes NodePort Service exposing port 3000
├── hpa.yaml             # HorizontalPodAutoscaler (HPA v2) configuration
└── README.md            # Project documentation
```

---

## ⚙️ Prerequisites

Before you begin, ensure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) (v20+)
- [Minikube](https://minikube.sigs.k8s.io/docs/start/) (v1.30+)
- [kubectl](https://kubernetes.io/docs/tasks/tools/)
- [Node.js](https://nodejs.org/) (v18+, optional for running locally)

---

## 🚀 Quick Start Guide

### 1. Start Minikube & Enable Metrics Server

HPA relies on the Kubernetes **Metrics Server** to scrape CPU utilization from pods.

```bash
# Start Minikube with the Docker driver
minikube start --driver=docker

# Enable the metrics-server addon (MANDATORY for HPA)
minikube addons enable metrics-server
```

Verify that the metrics server is running:

```bash
kubectl get pods -n kube-system | grep metrics-server
```

---

### 2. Build the Docker Image

Because `deployment.yaml` uses `imagePullPolicy: Never` and local image tag `local-node-autoscale:v4`, build the image inside Minikube's Docker environment:

#### On Linux / macOS / Git Bash:
```bash
# Point local docker CLI to Minikube's internal Docker daemon
eval $(minikube docker-env)

# Build image
docker build -t local-node-autoscale:v4 .
```

#### On Windows (PowerShell):
```powershell
& minikube -p minikube docker-env --shell powershell | Invoke-Expression
docker build -t local-node-autoscale:v4 .
```

*Alternatively, use `minikube image build`:*
```bash
minikube image build -t local-node-autoscale:v4 .
```

---

### 3. Deploy Kubernetes Manifests

Apply the deployment, service, and autoscaler:

```bash
# Deploy Application Pods
kubectl apply -f deployment.yaml

# Create NodePort Service
kubectl apply -f service.yaml

# Create Horizontal Pod Autoscaler
kubectl apply -f hpa.yaml
```

---

### 4. Verify Deployment & HPA

Check that all resources were created successfully:

```bash
kubectl get deployments
kubectl get services
kubectl get hpa
```

> **Note**: It may take 1–2 minutes for the Metrics Server to collect the first round of metrics and replace `<unknown>/50%` with actual CPU values in `kubectl get hpa`.

---

## 🧪 Testing Autoscaling under Load

### 1. Expose the Service

Forward the service port to your local machine:

```bash
kubectl port-forward svc/node-app-service 3000:3000
```

Verify the endpoint in a separate terminal:

```bash
curl http://localhost:3000/health
# Response: Server is running
```

---

### 2. Monitor Autoscaling in Real-Time

Open two separate terminal windows to watch the pods and HPA status:

**Terminal 1 — Watch HPA Metrics:**
```bash
# Watch HPA CPU utilization & replica count
kubectl get hpa node-app-hpa --watch
```

**Terminal 2 — Watch Pods scaling:**
```bash
# Watch Pod statuses and new pods being scheduled
kubectl get pods -l app=node-app --watch
```

---

### 3. Generate Traffic / High Load

Send continuous requests to the CPU-intensive `/load` endpoint:

#### Bash / Linux / macOS / Git Bash:
```bash
while true; do curl -s http://localhost:3000/load; echo ""; sleep 0.2; done
```

#### PowerShell:
```powershell
while ($true) { (Invoke-WebRequest -Uri "http://localhost:3000/load" -UseBasicParsing).Content; Start-Sleep -Milliseconds 200 }
```

#### What happens:
1. Pod CPU utilization exceeds the **50%** target threshold (e.g. jumps to 150%+).
2. The HPA detects high CPU usage and scales replicas from `1` → `2` → `3` (max limit).
3. Load is distributed across the newly created pods, stabilizing CPU utilization.

---

### 4. Observe Scale-Down (Cooldown)

Stop the load script (`Ctrl + C`).

- CPU usage will drop back below 50%.
- After Kubernetes' default stabilization cooldown period (~5 minutes), the HPA will automatically terminate extra pods and scale back down to `1` replica (`minReplicas`).

---

## 🔧 Kubernetes Configuration Reference

### Resource Requests & Limits ([deployment.yaml](deployment.yaml))
Autoscaling requires precise resource requests so Kubernetes knows what 100% utilization represents:
```yaml
resources:
  requests:
    cpu: "50m"      # 0.05 CPU core
    memory: "64Mi"
  limits:
    cpu: "200m"     # 0.20 CPU core
    memory: "128Mi"
```

### Autoscaling Rules ([hpa.yaml](hpa.yaml))
```yaml
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: node-app-deployment
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 50
```

---

## 🧹 Cleanup

To remove all created Kubernetes resources:

```bash
kubectl delete -f hpa.yaml
kubectl delete -f service.yaml
kubectl delete -f deployment.yaml
```

To stop or delete the Minikube cluster:

```bash
minikube stop
# Or delete entirely:
# minikube delete
```

---

## 📄 License
This project is open source and available under the [ISC License](package.json).
