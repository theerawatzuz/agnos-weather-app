#!/bin/bash

# Usage: 
#   ./build-and-push.sh <dockerhub-username> [tag] [--no-push]
#   Examples:
#     ./build-and-push.sh myuser v1.0.0
#     ./build-and-push.sh myuser v1.0.0 --no-push
#     ./build-and-push.sh myuser $(date +%Y%m%d-%H%M%S)

if [ -z "$1" ]; then
  echo "Usage: ./build-and-push.sh <dockerhub-username> [tag] [--no-push]"
  echo "Default tag: current timestamp (YYYYMMDD-HHMMSS)"
  exit 1
fi

USERNAME=$1
IMAGE_NAME="weather-ingest"
TAG="${2:-$(date +%Y%m%d-%H%M%S)}"
NO_PUSH=false

if [ "$2" == "--no-push" ] || [ "$3" == "--no-push" ]; then
  NO_PUSH=true
fi

echo "Building Docker image..."
docker build -t $USERNAME/$IMAGE_NAME:$TAG .

if [ "$NO_PUSH" == "false" ]; then
  echo "Pushing to Docker Hub..."
  docker push $USERNAME/$IMAGE_NAME:$TAG
  echo "Done! Image pushed: $USERNAME/$IMAGE_NAME:$TAG"
else
  echo "Done! Image built locally: $USERNAME/$IMAGE_NAME:$TAG"
  echo "To push later: docker push $USERNAME/$IMAGE_NAME:$TAG"
fi
