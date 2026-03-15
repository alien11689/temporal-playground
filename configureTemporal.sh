#!/bin/bash

set -e

# Colours for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No colour

# Configuration
TEMPORAL_HOST="${TEMPORAL_HOST:-localhost}"
TEMPORAL_PORT="${TEMPORAL_PORT:-7233}"
NAMESPACE="issue-system"

echo -e "${YELLOW}Waiting for the Temporal Server to come online...${NC}"

# Health check - wait for Temporal to be available
max_attempts=60
attempt=0

while [ $attempt -lt $max_attempts ]; do
  if nc -z "${TEMPORAL_HOST}" "${TEMPORAL_PORT}" 2>/dev/null; then
    echo -e "${GREEN}Temporal Server's all set!${NC}"
    break
  fi
  
  attempt=$((attempt + 1))
  echo "Attempt $attempt/$max_attempts - Still waiting for Temporal Server..."
  sleep 1
done

if [ $attempt -eq $max_attempts ]; then
  echo -e "${RED}Oops! Temporal Server didn't come online after ${max_attempts} attempts${NC}"
  exit 1
fi

# Give it a moment to fully initialise
sleep 5

echo -e "${YELLOW}Creating namespace: $NAMESPACE${NC}"
docker compose exec temporal temporal operator namespace create $NAMESPACE --address temporal:${TEMPORAL_PORT}

echo -e "${YELLOW}Setting up search attributes...${NC}"
docker compose exec temporal temporal operator search-attribute create \
  --namespace $NAMESPACE \
  --name ProjectId \
  --type Keyword \
  --address temporal:${TEMPORAL_PORT}

docker compose exec temporal temporal operator search-attribute create \
  --namespace $NAMESPACE \
  --name IssueAuthor \
  --type Keyword \
  --address temporal:${TEMPORAL_PORT}

docker compose exec temporal temporal operator search-attribute create \
  --namespace $NAMESPACE \
  --name IssueStatus \
  --type Keyword \
  --address temporal:${TEMPORAL_PORT}

echo -e "${GREEN}All done! Temporal's configured and ready to roll.${NC}"
echo -e "${GREEN}Temporal UI: http://localhost:8080${NC}"
echo -e "${GREEN}Temporal gRPC: ${TEMPORAL_HOST}:${TEMPORAL_PORT}${NC}"
