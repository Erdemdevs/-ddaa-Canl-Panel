#!/bin/bash
pkill -f "node server.js" && echo "Sistem KAPATILDI. İstek gitmiyor." || echo "Zaten kapalıydı."
