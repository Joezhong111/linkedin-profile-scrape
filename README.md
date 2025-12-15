# LinkedIn Insights Pro

A modern web application for scraping LinkedIn profiles and generating AI-powered insights using Apify, Supabase, and Google Gemini.

## Features

- 🔎 Scraping - Extract profile data using Apify's LinkedIn scraper
- 💾 Database Storage - Save profiles to Supabase for persistent storage
- ✨ AI Insights - Generate executive summaries using Google Gemini
- 🗂️ Profile Management - View, manage, and analyze saved profiles
- 🎨 Modern UI - Built with React and Tailwind CSS

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Accounts and API keys for:
  - [Apify](https://apify.com) - For LinkedIn scraping
  - [Supabase](https://supabase.com) - For data storage
  - [Google Gemini](https://ai.google.dev) - For AI analysis (optional)

## Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your credentials:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
# Apify API Key
# Get from: https://apify.com/account/integrations
VITE_APIFY_TOKEN=your_apify_api_key_here

# Supabase Configuration
# Get from: https://supabase.com (Project Settings)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Google Gemini API Key (Optional)
# Get from: https://ai.google.dev/
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Setup Supabase Database

Run this SQL in your Supabase SQL Editor to create the required table:

```sql
create table linkedin_profiles (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  profile_url text unique not null,
  full_name text,
  headline text,
  location text,
  about text,
  photo_url text,
  raw_data jsonb,
  ai_summary text
);
```

### 4. Run the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Deploy

This project is ready to deploy to Vercel or Netlify.

### Vercel (recommended)

1. Install CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel`
4. In the Vercel dashboard, set environment variables:
   - `VITE_APIFY_TOKEN`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_GEMINI_API_KEY` (optional)
5. Promote to production: `vercel --prod`

The repo includes `vercel.json` for sensible defaults.

### Netlify

1. Connect your repository on Netlify
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Add the same environment variables in Site settings → Build & deploy → Environment

The repo includes `netlify.toml` with SPA redirects and cache headers.

## Environment Variables

| Variable                 | Required | Description                           |
| ------------------------ | -------- | ------------------------------------- |
| `VITE_APIFY_TOKEN`       | Yes      | Apify API token for LinkedIn scraping |
| `VITE_SUPABASE_URL`      | Yes      | Supabase project URL                  |
| `VITE_SUPABASE_ANON_KEY` | Yes      | Supabase anonymous key                |
| `VITE_GEMINI_API_KEY`    | No       | Google Gemini API key for AI analysis |

## How to Get API Keys

### Apify

1. Go to https://apify.com
2. Sign up and log in
3. Navigate to Account → Integrations
4. Copy your API Token

### Supabase

1. Go to https://supabase.com
2. Create a new project
3. Go to Project Settings → API
4. Copy `Project URL` and `anon public` key

### Google Gemini

1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key in Google Cloud Console

## Project Structure

```
├── App.tsx              # Main application component
├── index.tsx            # Entry point
├── services/
│   ├── apify.ts        # LinkedIn scraping service
│   ├── supabase.ts     # Database service
│   └── gemini.ts       # AI analysis service
├── types.ts            # TypeScript type definitions
├── vite.config.ts      # Vite configuration
└── .env.local          # Environment variables (create from .env.example)
```

## Security Notes

- **Never commit `.env.local`** - It contains sensitive API keys
- Use `.env.example` as a template for other developers
- Keep your API keys confidential
- Rotate keys regularly if compromised

## Troubleshooting

### "Environment variables are missing"

Make sure all required variables in `.env.local` are filled in correctly.

### "Supabase Connection Failed"

- Verify your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correct
- Check that the `linkedin_profiles` table exists in your Supabase database
- Ensure RLS (Row Level Security) policies allow public access if needed

### "Apify Scraping Failed"

- Verify your `VITE_APIFY_TOKEN` is correct
- Check that you have sufficient Apify credits
- Ensure the LinkedIn URLs are valid and public

## License

MIT
