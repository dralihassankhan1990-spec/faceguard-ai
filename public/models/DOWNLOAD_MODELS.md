# Model weights

The `*-shard*` binary weight files are not stored in git (they exceed push
size limits). The small `*-weights_manifest.json` files ARE included.

After cloning, run:

```bash
cd public/models
bash fetch-models.sh
```

This downloads the face-api.js weights (ssd_mobilenetv1, face_landmark_68,
face_recognition) from the official face-api.js repository into this folder.
The app loads them from `/models` at runtime — no code changes needed.
