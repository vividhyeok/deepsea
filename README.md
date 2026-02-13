
# DeepSea

A minimalist AI chat interface **powered by DeepSeek**, with GPT-4 integration for advanced reasoning.

## Features

- **AI Model Strategy**:
  - **Primary**: DeepSeek for all standard interactions (Lite, Standard, Auto modes)
  - **Exception**: GPT-4 (OpenAI) exclusively for Hardcore mode when deep analysis is required
  - **Auto Mode**: Intelligently selects between Lite and Standard, **never escalates to GPT-4**

- **Multiple Response Modes**:
  - **Lite**: Quick, concise answers (max 5 sentences) - DeepSeek
  - **Standard**: Structured explanations with core summary, details, and limitations - DeepSeek
  - **Hardcore**: Deep analysis with internal verification - GPT-4
  - **Auto**: Automatically selects between Lite and Standard - DeepSeek only

- **Secure Authentication**: JWT-based login system
- **Conversation Management**: Save/load chats as Markdown files
- **Message Actions**: Edit user messages, regenerate AI responses, export individual messages
- **Streaming Responses**: Real-time response generation
- **Clean UI**: Minimalist, DeepSeek-inspired interface with logo-centric design

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **AI Providers**: 
  - DeepSeek API (primary - lite/standard/auto modes)
  - OpenAI GPT-4 (hardcore mode only)
- **Authentication**: JWT with httpOnly cookies
- **Styling**: Tailwind CSS
- **Deployment**: Vercel (Edge Runtime)
- **Language**: TypeScript

## Setup & Run

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Setup**
   Copy `.env.example` to `.env.local` and fill in your details:
   ```bash
   cp .env.example .env.local
   ```
   
   Required environment variables:
   ```env
   APP_USERNAME=admin
   APP_PASSWORD=password123
   JWT_SECRET_KEY=your-secret-key-min-32-chars
   
   # DeepSeek API Key (Required)
   DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   
   # OpenAI API Key (Required for Hardcore mode)
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

4. **Build for Production**
   ```bash
   npm run build
   npm start
   ```

## Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add Environment Variables in Vercel Project Settings
4. Deploy

## License

MIT
