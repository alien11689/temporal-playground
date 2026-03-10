#!/bin/bash

API=http://localhost:3000

echo "=== CREATE PROJECT ==="

PROJECT_RESPONSE=$(curl -s -X POST $API/projects)

export PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.projectId')

echo "PROJECT_ID=$PROJECT_ID"


echo "=== CREATE ISSUE ==="

ISSUE_RESPONSE=$(curl -s -X POST $API/issues \
  -H "content-type: application/json" \
  -d "{
    \"author\": \"alice\",
    \"projectId\": \"$PROJECT_ID\",
    \"title\": \"Example issue\"
}")

export ISSUE_ID=$(echo $ISSUE_RESPONSE | jq -r '.workflowId')

echo "ISSUE_ID=$ISSUE_ID"


echo "=== ADD COMMENT ==="

curl -s -X POST $API/issues/$ISSUE_ID/comments \
  -H "content-type: application/json" \
  -d '{
    "author": "bob",
    "message": "Looking into it"
}' | jq


echo "=== CHANGE ISSUE STATUS ==="

curl -s -X POST $API/issues/$ISSUE_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"PROCESSING"}' | jq


echo "=== GET ISSUE STATUS ==="

curl -s $API/issues/$ISSUE_ID/status | jq


echo "=== ADD SECOND COMMENT ==="

curl -s -X POST $API/issues/$ISSUE_ID/comments \
  -H "content-type: application/json" \
  -d '{
    "author": "charlie",
    "message": "Investigating deeper"
}' | jq

echo "=== CHANGE PROJECT STATUS ==="

curl -s -X POST $API/projects/$PROJECT_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"DEPRECATED"}' | jq

echo "=== DEACTIVATE PROJECT (CLOSE ISSUES) ==="

curl -s -X POST $API/projects/$PROJECT_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"INACTIVE"}' | jq

echo "=== GET PROJECT STATE ==="

curl -s $API/projects/$PROJECT_ID | jq

echo "=== ISSUE STATUS AFTER PROJECT CLOSE ==="

curl -s $API/issues/$ISSUE_ID/status | jq

echo "=== REACTIVATE PROJECT ==="

curl -s -X POST $API/projects/$PROJECT_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"ACTIVE"}' | jq


echo "=== DONE ==="