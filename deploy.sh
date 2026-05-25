#!/bin/bash
set -euo pipefail

ENV=${1:-dev}
SERVER="ghmate@ghmate.iptime.org"
SSH_PORT=222
PROJECT_DIR="/srv/projects/longdcam"

echo "=== Deploying longdcam ($ENV) ==="

case $ENV in
  dev)
    COMPOSE_FILE="docker-compose.dev.yml"
    PROJECT_NAME="longdcam_dev"
    ;;
  prod)
    COMPOSE_FILE="docker-compose.yml"
    PROJECT_NAME="longdcam_prod"
    ;;
  *)
    echo "Usage: ./deploy.sh [dev|prod]"
    exit 1
    ;;
esac

echo ">> Deploying to $SERVER:$SSH_PORT"

ssh -p $SSH_PORT $SERVER << ENDSSH
  set -e
  cd $PROJECT_DIR

  echo ">> Pulling latest code..."
  git pull origin main

  echo ">> Building and starting services..."
  docker compose -p $PROJECT_NAME -f $COMPOSE_FILE up --build -d

  echo ">> Waiting for health check..."
  sleep 5

  echo ">> Reloading nginx..."
  docker exec nginx_proxy nginx -s reload 2>/dev/null || true

  echo ">> Deployment complete!"
  docker compose -p $PROJECT_NAME -f $COMPOSE_FILE ps
ENDSSH

echo "=== Done ==="
