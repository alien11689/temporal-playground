#!/bin/bash
set -e

cleanup() {
  echo "=== Cleaning up ==="
  pkill -f "tsx src/worker" 2>/dev/null || true
  sleep 3
  pkill -9 -f "tsx src/worker" 2>/dev/null || true
  docker compose down -v 2>/dev/null || true
}

trap cleanup EXIT

echo "=== Stopping Docker Compose ==="
docker compose down 2>/dev/null || true

echo "=== Starting Docker Compose ==="
docker compose up -d

echo "=== Waiting for PostgreSQL ==="
until docker compose exec postgres pg_isready -U postgres &>/dev/null; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done
echo "PostgreSQL is ready!"

echo "=== Waiting for Temporal ==="
until nc -z localhost 7233 &>/dev/null; do
  echo "Waiting for Temporal gRPC..."
  sleep 2
done
echo "Temporal is ready!"

echo "=== Configuring Temporal ==="
chmod +x configureTemporal.sh
./configureTemporal.sh || true

echo "=== Starting Worker in background ==="
npm run worker &
sleep 5

echo "=== Running tests ==="
npm run test
TEST_EXIT_CODE=$?

echo "=== Tests completed with exit code: $TEST_EXIT_CODE ==="
exit $TEST_EXIT_CODE
