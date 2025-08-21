# Server-Side Image Comparison Server

This server handles image comparison for the CityQuest app using CLIP (Contrastive Language-Image Pre-training) model.

## Features

- **Server-Side Image Storage**: Answer images are stored on the server
- **Optimized API**: Only player images are sent from frontend, reducing bandwidth by 50%
- **Backward Compatibility**: Still supports the old API format for testing
- **Automatic Image Loading**: Server loads answer images based on checkpoint ID

## Setup

### 1. Install Dependencies

```bash
pip install flask flask-cors torch transformers pillow
```

### 2. Directory Structure

```
cityquest/
├── assets/
│   └── beaverton/
│       ├── IMG_2218.jpeg
│       ├── IMG_2219.jpeg
│       └── ... (all 20 answer images)
├── src/
│   ├── clip_server.py
│   └── ...
└── SERVER_README.md
```

### 3. Run the Server

```bash
cd src
python clip_server.py
```

The server will start on `http://localhost:5000`

## API Endpoints

### POST /compare

**New Format (Recommended):**
```json
{
  "playerImage": "data:image/jpeg;base64,/9j/4QAsRXhpZgAASUkqAAgAAA...",
  "checkpointId": 1
}
```

**Response:**
```json
{
  "similarity": 0.85
}
```

**Legacy Format (Backward Compatibility):**
```json
{
  "img1": "data:image/jpeg;base64,/9j/4QAsRXhpZgAASUkqAAgAAA...",
  "img2": "data:image/jpeg;base64,/9j/4QAsRXhpZgAASUkqAAgAAA..."
}
```

## How It Works

1. **Frontend**: Sends only the player's photo and checkpoint ID
2. **Server**: Loads the corresponding answer image from local storage
3. **CLIP Model**: Generates embeddings for both images
4. **Comparison**: Calculates cosine similarity between embeddings
5. **Response**: Returns similarity score (0-1, where 1 is identical)

## Benefits

- ✅ **50% Less Data Transfer**: Only one image sent instead of two
- ✅ **Faster Uploads**: Smaller payload size
- ✅ **Better Performance**: Server handles image loading
- ✅ **Scalable**: Easy to add new quests without frontend changes
- ✅ **Secure**: Answer images never leave the server

## Adding New Quests

To add a new quest:

1. Add answer images to `assets/[quest-name]/`
2. Update `ANSWER_IMAGES` mapping in `clip_server.py`:
```python
ANSWER_IMAGES = {
    # Existing Beaverton images...
    21: "assets/newquest/answer1.jpg",
    22: "assets/newquest/answer2.jpg",
    # ... etc
}
```

## Error Handling

The server returns appropriate error messages for:
- Missing checkpoint IDs
- File not found errors
- Invalid request formats
- Image processing errors

## Performance Notes

- CLIP model is loaded once at startup
- Images are processed in memory
- Similarity calculation is GPU-accelerated if available
- Response time typically < 2 seconds per comparison

