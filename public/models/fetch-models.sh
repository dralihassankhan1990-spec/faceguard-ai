#!/bin/bash
# Downloads the face-api.js model weights into public/models/.
# These binary weight files are excluded from git (push size limits);
# run this once after cloning.
set -e
cd "$(dirname "$0")"
BASE="https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
FILES="ssd_mobilenetv1_model-weights_manifest.json ssd_mobilenetv1_model-shard1 ssd_mobilenetv1_model-shard2 face_landmark_68_model-weights_manifest.json face_landmark_68_model-shard1 face_recognition_model-weights_manifest.json face_recognition_model-shard1 face_recognition_model-shard2"
for f in $FILES; do
  if [ -f "$f" ]; then
    echo "exists: $f"
  else
    echo "downloading: $f"
    curl -sSL -o "$f" "$BASE/$f"
  fi
done
echo "All model weights ready in public/models/."
