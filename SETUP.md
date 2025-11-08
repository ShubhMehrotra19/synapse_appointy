# Synapse Setup Guide

## Quick Start

### 1. Web App Setup

```bash
cd webapp
npm install
```

### 2. Environment Configuration

Create a `.env` file in the `webapp` directory with the following content:

```env
DATABASE_PATH=./synapse.db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
OPENAI_API_KEY=your-openai-api-key-here
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Important**: 
- Replace `JWT_SECRET` with a random secure string (you can generate one online)
- Add your OpenAI API key from https://platform.openai.com/api-keys

### 3. Start the Web App

```bash
cd webapp
npm run dev
```

The app will be available at `http://localhost:3000`

### 4. Browser Extension Setup

1. Open Chrome/Edge
2. Go to `chrome://extensions/` or `edge://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `extension` folder

### 5. Extension Icons

You need to add icon files to `extension/icons/`:
- `icon16.png` (16x16)
- `icon48.png` (48x48)  
- `icon128.png` (128x128)

You can create simple icons or use placeholder images. The extension will work without them, but you'll see a default icon.

## First Time Usage

1. Register an account at `http://localhost:3000/register`
2. Login to your account
3. Click the extension icon in your browser
4. Click "Open Synapse" to authenticate the extension
5. Start capturing content from any webpage!

## Troubleshooting

- **Extension not connecting**: Make sure the web app is running on `http://localhost:3000`
- **Database errors**: The database will be created automatically on first run
- **AI categorization not working**: Check that your OpenAI API key is correctly set in `.env`

