minikube start --driver=docker

while true; do echo "=== Current Time: $(date +%H:%M:%S) ==="; kubectl get hpa; echo ""; sleep 10; done

while true; do echo "=== Current Time: $(date +%H:%M:%S) ==="; kubectl get pods; echo ""; sleep 10; done

kubectl port-forward svc/node-app-service 3000:3000

while true; do curl -s http://localhost:3000/load; echo; sleep 1; done
