#!/bin/bash

API=http://localhost:3000

echo "=== CREATE PROJECT ==="

PROJECT_RESPONSE=$(curl -s -X POST $API/projects)

export PROJECT_ID=$(echo $PROJECT_RESPONSE | jq -r '.id')

echo "PROJECT_ID=$PROJECT_ID"


echo "=== CREATE ISSUE #1 ==="

ISSUE1_RESPONSE=$(curl -s -X POST $API/issues \
  -H "content-type: application/json" \
  -d "{
    \"author\": \"alice\",
    \"projectId\": \"$PROJECT_ID\",
    \"title\": \"First issue - will be closed manually\"
}")

export ISSUE1_ID=$(echo $ISSUE1_RESPONSE | jq -r '.id')

echo "ISSUE1_ID=$ISSUE1_ID"


echo "=== ADD COMMENT TO ISSUE #1 ==="

curl -s -X POST $API/issues/$ISSUE1_ID/comments \
  -H "content-type: application/json" \
  -d '{
    "author": "bob",
    "message": "Looking into it"
}' | jq


echo "=== CHANGE ISSUE #1 STATUS TO PROCESSING ==="

curl -s -X POST $API/issues/$ISSUE1_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"PROCESSING"}' | jq


echo "=== GET ISSUE #1 STATUS ==="

curl -s $API/issues/$ISSUE1_ID/status | jq


echo "=== ADD SECOND COMMENT TO ISSUE #1 ==="

curl -s -X POST $API/issues/$ISSUE1_ID/comments \
  -H "content-type: application/json" \
  -d '{
    "author": "charlie",
    "message": "Investigating deeper"
}' | jq


echo "=== CLOSE ISSUE #1 MANUALLY (FINISHED) ==="

curl -s -X POST $API/issues/$ISSUE1_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"FINISHED"}' | jq


echo "=== CREATE ISSUE #2 (will be batch-closed) ==="

ISSUE2_RESPONSE=$(curl -s -X POST $API/issues \
  -H "content-type: application/json" \
  -d "{
    \"author\": \"alice\",
    \"projectId\": \"$PROJECT_ID\",
    \"title\": \"Second issue - will be batch closed\"
}")

export ISSUE2_ID=$(echo $ISSUE2_RESPONSE | jq -r '.id')

echo "ISSUE2_ID=$ISSUE2_ID"


echo "=== CREATE ISSUE #3 (will be batch-closed) ==="

ISSUE3_RESPONSE=$(curl -s -X POST $API/issues \
  -H "content-type: application/json" \
  -d "{
    \"author\": \"alice\",
    \"projectId\": \"$PROJECT_ID\",
    \"title\": \"Third issue - will be batch closed\"
}")

export ISSUE3_ID=$(echo $ISSUE3_RESPONSE | jq -r '.id')

echo "ISSUE3_ID=$ISSUE3_ID"


echo "=== GET ISSUE #2 STATUS BEFORE PROJECT CLOSE ==="

curl -s $API/issues/$ISSUE2_ID/status | jq


echo "=== GET ISSUE #3 STATUS BEFORE PROJECT CLOSE ==="

curl -s $API/issues/$ISSUE3_ID/status | jq


echo "=== CHANGE PROJECT STATUS TO DEPRECATED ==="

curl -s -X POST $API/projects/$PROJECT_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"DEPRECATED"}' | jq


echo "=== DEACTIVATE PROJECT (BATCH CLOSE ISSUES #2 and #3) ==="

curl -s -X POST $API/projects/$PROJECT_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"INACTIVE"}' | jq


echo "=== GET PROJECT STATE AFTER DEACTIVATION ==="

curl -s $API/projects/$PROJECT_ID | jq


echo ""
echo "=== VERIFICATION: CHECK ALL ISSUE STATUSES ==="
echo ""

echo "ISSUE #1 STATUS (should be FINISHED):"
curl -s $API/issues/$ISSUE1_ID/status | jq

echo ""
echo "ISSUE #2 STATUS (should be REJECTED due to batch operation):"
curl -s $API/issues/$ISSUE2_ID/status | jq

echo ""
echo "ISSUE #3 STATUS (should be REJECTED due to batch operation):"
curl -s $API/issues/$ISSUE3_ID/status | jq


echo ""
echo "=== REACTIVATE PROJECT ==="

curl -s -X POST $API/projects/$PROJECT_ID/status \
  -H "content-type: application/json" \
  -d '{"status":"ACTIVE"}' | jq


echo "=== DONE ==="