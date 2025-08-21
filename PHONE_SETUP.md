# Making CityQuest Work on Your Phone

## The Problem
Your phone can't connect to `localhost:5000` because `localhost` on your phone refers to the phone itself, not your computer.

## Quick Solutions

### Option 1: Deploy the Server (Recommended)

1. **Deploy to Railway** (Free tier available):
   - Go to [railway.app](https://railway.app)
   - Sign up and connect your GitHub repo
   - Deploy - Railway will auto-detect it's a Python app
   - Get your server URL (e.g., `https://your-app.railway.app`)

2. **Update the frontend**:
   - Edit `src/config.js`
   - Change the URL to your deployed server:
   ```javascript
   export const SERVER_URL = 'https://your-app.railway.app';
   ```

3. **Deploy the frontend**:
   - Push to GitHub
   - Vercel will auto-deploy

### Option 2: Use Your Computer's IP Address (Temporary)

1. **Find your computer's IP address**:
   ```bash
   # On Windows
   ipconfig
   
   # On Mac/Linux
   ifconfig
   ```
   Look for something like `192.168.1.100`

2. **Update the config**:
   - Edit `src/config.js`
   - Change to your computer's IP:
   ```javascript
   export const SERVER_URL = 'http://192.168.1.100:5000';
   ```

3. **Make sure your computer and phone are on the same WiFi network**

4. **Start the server**:
   ```bash
   cd src
   python clip_server.py
   ```

### Option 3: Use ngrok (Temporary)

1. **Install ngrok**:
   - Download from [ngrok.com](https://ngrok.com)
   - Sign up for free account

2. **Start your server**:
   ```bash
   cd src
   python clip_server.py
   ```

3. **Create tunnel**:
   ```bash
   ngrok http 5000
   ```

4. **Update config**:
   - Copy the ngrok URL (e.g., `https://abc123.ngrok.io`)
   - Edit `src/config.js`:
   ```javascript
   export const SERVER_URL = 'https://abc123.ngrok.io';
   ```

## Testing

After making changes:

1. **Deploy frontend** (if using Railway or ngrok)
2. **Test on phone**:
   - Open the app
   - Try taking a photo and checking answer
   - Should work without "load failed" error

## Troubleshooting

- **Still getting "load failed"**: Check that the server URL is correct and accessible
- **CORS errors**: The server already has CORS configured for all origins
- **Server not starting**: Make sure you have all dependencies installed (`pip install -r requirements.txt`)

## Recommended Approach

Use **Option 1 (Railway)** for the best long-term solution. It's free and will work from anywhere.

