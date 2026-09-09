#!/bin/bash
# test-http.sh — hits the real running server the way your frontend will.
# Usage: ./test-http.sh
# (make sure `npm run dev` or `node src/server.js` is running in another terminal first)

echo "=== Health check ==="
curl -s http://localhost:4000/health
echo -e "\n"

echo "=== Valid number ==="
curl -s -X POST http://localhost:4000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+9999991000"}'
echo -e "\n"

echo "=== Invalid number (should be 400) ==="
curl -s -o /tmp/resp.json -w "HTTP %{http_code}\n" -X POST http://localhost:4000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"123"}'
cat /tmp/resp.json
echo -e "\n"

echo "=== Missing number (should be 400) ==="
curl -s -o /tmp/resp2.json -w "HTTP %{http_code}\n" -X POST http://localhost:4000/api/verify \
  -H "Content-Type: application/json" \
  -d '{}'
cat /tmp/resp2.json
echo -e "\n"

echo "=== Rate limit check (11 rapid requests, should 429 on the 11th) ==="
for i in $(seq 1 11); do
  curl -s -o /dev/null -w "%{http_code} " -X POST http://localhost:4000/api/verify \
    -H "Content-Type: application/json" \
    -d '{"phoneNumber":"+9999991000"}'
done
echo ""
