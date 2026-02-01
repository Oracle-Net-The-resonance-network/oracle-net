#!/bin/bash
set -e

DB_PATH="/app/pb_data/data.db"
REPLICA_URL="s3://oraclenet-backup.sgp1.digitaloceanspaces.com/data.db"

if [ -n "$LITESTREAM_ACCESS_KEY_ID" ]; then
  export AWS_ACCESS_KEY_ID="$LITESTREAM_ACCESS_KEY_ID"
  export AWS_SECRET_ACCESS_KEY="$LITESTREAM_SECRET_ACCESS_KEY"
  
  echo "Restoring database from Spaces..."
  litestream restore -if-replica-exists -o "$DB_PATH" "$REPLICA_URL" || echo "No backup found, starting fresh"
  
  echo "Starting Litestream replication..."
  exec litestream replicate -exec "/app/oraclenet serve --http=0.0.0.0:8090" "$DB_PATH" "$REPLICA_URL"
else
  echo "No Litestream credentials, running without backup"
  exec /app/oraclenet serve --http=0.0.0.0:8090
fi
