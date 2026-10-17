#!/bin/bash
cd "$(dirname "$0")"
pkill -f "node server.js" 2>/dev/null
sleep 1
(nohup node server.js > server.log 2>&1 &)
sleep 3
open http://localhost:3000
echo "Sistem AÇILDI. Bu pencereyi kapatabilirsin."
