# Synapse - Your Second Brain

A web application and browser extension that helps you capture and organize web content with AI-powered categorization.

## Features

- 🔐 User authentication and onboarding
- 🧠 AI-powered content categorization (Images, Products, Books, Articles, Videos, Study)
- 🌐 Browser extension for easy content capture
- 📦 Organized content display by category
- 💾 Individual database per user

## Project Structure

```
TaskRound/
├── extension/          # Browser extension files
│   ├── manifest.json
│   ├── popup.html/js/css
│   ├── content.js/css
│   └── background.js
├── webapp/            # Next.js web application
│   ├── pages/         # Next.js pages and API routes
│   ├── lib/           # Database, auth, and AI utilities
│   └── styles/        # Tailwind CSS styles
└── README.md
```

## Setup Instructions

### 1. Web App Setup

1. Navigate to the webapp directory:
```bash
cd webapp
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env` (already created)
   - Add your OpenAI API key to `.env`:
     ```
     OPENAI_API_KEY=your-openai-api-key-here
     ```
   - Update `JWT_SECRET` with a secure random string

4. Run the development server:
```bash
npm run dev
```

The web app will be available at `http://localhost:3000`

### 2. Browser Extension Setup

1. Open Chrome/Edge and navigate to:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. Enable "Developer mode" (toggle in top right)

3. Click "Load unpacked"

4. Select the `extension` folder

5. The extension icon should appear in your browser toolbar

### 3. Extension Icons

You'll need to add icon files to `extension/icons/`:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

You can create simple icons or use placeholder images for now.

## Usage

1. **Register/Login**: Create an account or login at `http://localhost:3000`

2. **Authenticate Extension**: 
   - Click the extension icon
   - Click "Open Synapse" to login
   - The extension will automatically sync your authentication

3. **Capture Content**:
   - Navigate to any webpage
   - Click the extension icon
   - Click "Capture Page"
   - Click on any element on the page to capture it
   - The AI will automatically categorize the content

4. **View Content**:
   - Go to your dashboard at `http://localhost:3000/dashboard`
   - Click on any category card to view your saved content

## API Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/user/me` - Get current user
- `POST /api/content` - Save content
- `GET /api/content` - Get user's content
- `POST /api/ai/categorize` - Categorize content with AI

## Technologies Used

- **Frontend**: Next.js, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite
- **Authentication**: JWT
- **AI**: OpenAI API (GPT-3.5-turbo)
- **Extension**: Chrome Extension Manifest V3

## Environment Variables

```env
DATABASE_PATH=./synapse.db
JWT_SECRET=your-super-secret-jwt-key
OPENAI_API_KEY=your-openai-api-key-here
PORT=3000
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Notes

- The database is stored locally as `synapse.db` in the webapp directory
- Each user has their own isolated content
- The extension requires the web app to be running to save content
- Make sure to update the API URL in the extension if you change the port

## Future Enhancements

- Search functionality
- Content editing and notes
- Export capabilities
- Tags and custom categories
- Content preview and thumbnails
- Multi-device sync

