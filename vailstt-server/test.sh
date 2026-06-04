#!/bin/bash

BASE="https://web-production-42981.up.railway.app"
URL="https://youtu.be/dQw4w9WgXcQ"

echo "===== HEALTH ====="
curl "$BASE/api/health"
echo -e "\n"

echo "===== INFO ====="
curl "$BASE/api/info?url=$URL"
echo -e "\n"

echo "===== FORMATS ====="
curl "$BASE/api/formats?url=$URL"
echo -e "\n"

echo "===== AUDIO ====="
curl "$BASE/api/audio?url=$URL"
echo -e "\n"

echo "===== VAILSTT ====="
curl "$BASE/api/vailstt?url=$URL"
echo -e "\n"



