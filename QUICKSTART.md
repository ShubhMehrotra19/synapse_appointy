# Quick Start Guide

## 1. Setup Web App (5 minutes)

```bash
# Navigate to webapp directory
cd webapp

# Install dependencies
npm install

# Create .env file (copy from .env.example or create manually)
# Windows PowerShell:
Copy-Item .env.example .env
# Or manually create .env with:
# DATABASE_PATH=./synapse.db
# JWT_SECRET=your-random-secret-key-here
# OPENAI_API_KEY=your-openai-api-key
# PORT=3000
# NEXT_PUBLIC_API_URL=http://localhost:3000

# Start the server
npm run dev
```

**Important**: 
- Get your OpenAI API key from https://platform.openai.com/api-keys
- Generate a random JWT_SECRET (you can use: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

## 2. Setup Browser Extension (2 minutes)

1. Open Chrome/Edge browser
2. Go to `chrome://extensions/` or `edge://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the `extension` folder from this project

**Note**: You'll need to add icon files to `extension/icons/`:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)  
- `icon128.png` (128x128 pixels)

The extension will work without icons, but you'll see a default icon.

## 3. First Use

1. **Register**: Go to http://localhost:3000/register and create an account
2. **Login**: After registration, you'll be logged in automatically
3. **Sync Extension**: 
   - Click the extension icon in your browser
   - If it says "Not Connected", click "Open Synapse"
   - Login if needed - the extension will auto-sync
4. **Capture Content**:
   - Visit any website
   - Click the extension icon
   - Click "Capture Page"
   - Click on any element on the page to capture it
   - The AI will automatically categorize it!

5. **View Content**: Go to http://localhost:3000/dashboard to see all your captured content organized by category

## Troubleshooting

- **"Extension not connecting"**: Make sure the web app is running on port 3000
- **"Failed to categorize"**: Check your OpenAI API key in `.env`
- **Database errors**: The database is created automatically on first run
- **Icons missing**: The extension works without icons, just add them later for a better look

## Next Steps

- Add your OpenAI API key for AI categorization
- Customize the categories if needed
- Add icon files for the extension
- Start capturing content!

