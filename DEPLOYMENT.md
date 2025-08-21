# Server Deployment Guide

## Overview

The CityQuest app consists of two parts:
1. **Frontend**: React app deployed on Vercel
2. **Backend**: Python Flask server with CLIP model for image comparison

## Deployment Options

### Option 1: Railway (Recommended)

Railway is a great platform for Python apps with ML models.

1. **Sign up** at [railway.app](https://railway.app)
2. **Connect your GitHub** repository
3. **Deploy from GitHub**:
   - Select your repository
   - Railway will auto-detect it's a Python app
   - Set environment variables if needed
   - Deploy!

4. **Get your server URL** (e.g., `https://your-app.railway.app`)

5. **Update frontend** to use the new server URL:
   ```javascript
   // In src/LeafletCheckpointMap.jsx
   const response = await fetch('https://your-app.railway.app/compare', {
   ```

### Option 2: Render

1. **Sign up** at [render.com](https://render.com)
2. **Create a new Web Service**
3. **Connect your GitHub** repository
4. **Configure**:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python src/clip_server.py`
   - **Environment**: Python 3.9

### Option 3: Heroku

1. **Install Heroku CLI**
2. **Create Heroku app**:
   ```bash
   heroku create your-app-name
   ```
3. **Deploy**:
   ```bash
   git add .
   git commit -m "Deploy server"
   git push heroku main
   ```

### Option 4: Docker Deployment

1. **Build Docker image**:
   ```bash
   docker build -t cityquest-server .
   ```

2. **Run locally**:
   ```bash
   docker run -p 5000:5000 cityquest-server
   ```

3. **Deploy to cloud**:
   - **Google Cloud Run**
   - **AWS ECS**
   - **Azure Container Instances**

## Environment Variables

Set these in your deployment platform:

```bash
PORT=5000  # Optional, defaults to 5000
```

## Testing Your Deployment

1. **Health check**:
   ```bash
   curl https://your-server-url.railway.app/health
   ```

2. **Test image comparison**:
   ```bash
   python test_server.py
   ```
   (Update the URL in test_server.py first)

## Troubleshooting

### Common Issues

1. **Model loading fails**:
   - Check if you have enough memory (at least 2GB RAM)
   - Ensure internet connection for downloading CLIP model

2. **Image files not found**:
   - Verify assets are copied to the deployment
   - Check file paths in `ANSWER_IMAGES` mapping

3. **CORS errors**:
   - Server already has CORS configured for all origins
   - If issues persist, check your deployment platform's CORS settings

### Debug Commands

```bash
# Check server logs
railway logs  # or your platform's equivalent

# Test server locally
python src/clip_server.py

# Test with curl
curl -X POST https://your-server-url/compare \
  -H "Content-Type: application/json" \
  -d '{"playerImage":"data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A","checkpointId":1}'
```

## Cost Considerations

- **Railway**: Free tier available, then $5/month
- **Render**: Free tier available, then $7/month
- **Heroku**: No free tier, starts at $7/month
- **Google Cloud Run**: Pay per use, very cheap for low traffic

## Security Notes

- Server accepts requests from any origin (CORS: *)
- Consider adding authentication for production use
- Monitor server logs for unusual activity

