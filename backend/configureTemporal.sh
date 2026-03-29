#!/bin/bash

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
sleep 10

echo -e "${YELLOW}Setting up namespace: $NAMESPACE${NC}"
result=$(docker compose exec temporal temporal operator namespace create $NAMESPACE --address temporal:${TEMPORAL_PORT} 2>&1 || true)
if echo "$result" | grep -q "already exists"; then
  echo -e "${GREEN}Namespace $NAMESPACE already exists${NC}"
else
  echo -e "${GREEN}Namespace $NAMESPACE created${NC}"
fi

echo -e "${YELLOW}Setting up search attributes...${NC}"
for attr in "ProjectId:Keyword" "IssueAuthor:Keyword" "IssueStatus:Keyword"; do
  name=$(echo $attr | cut -d: -f1)
  type=$(echo $attr | cut -d: -f2)
  result=$(docker compose exec temporal temporal operator search-attribute create \
    --namespace $NAMESPACE \
    --name $name \
    --type $type \
    --address temporal:${TEMPORAL_PORT} 2>&1 || true)
  if echo "$result" | grep -q "already exists"; then
    echo "Search attribute '$name' already exists"
  elif echo "$result" | grep -q "Successfully"; then
    echo "Search attribute '$name' created"
  else
    echo "$result"
  fi
done

echo ""
echo -e "${GREEN}All done! Temporal's configured and ready to roll.${NC}"
echo -e "${GREEN}Temporal UI: http://localhost:8080${NC}"
echo -e "${GREEN}Temporal gRPC: ${TEMPORAL_HOST}:${TEMPORAL_PORT}${NC}"
