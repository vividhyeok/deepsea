
# DeepSea (Phase 1)

DeepSea is a personal AI web platform built with Next.js, TailwindCSS, and DeepSeek API.

## Features (Phase 1)
- **JWT Authentication**: Secure login with HttpOnly cookies.
- **DeepSeek Streaming**: Real-time chat with DeepSeek models.
- **Modes**:
    - **Lite**: Direct chat.
    - **Standard**: System instructions for accuracy.
    - **Hardcore**: Two-step reasoning (Plan -> Answer).
    - **Auto**: Context-aware mode switching.
- **Local Storage**: Save and load conversations as Markdown files.
- **Dark Mode UI**: Premium glassmorphism design.

## Project Structure
```
/src
  /app          # Next.js App Router
  /components   # React Components
  /lib          # Utilities (JWT, DeepSeek, Modes)
  /middleware.ts # Route Protection
```

## Setup & Run

1.  **Install Dependencies**
    ```bash
    npm install
    ```

2.  **Environment Setup**
    Copy `.env.example` to `.env.local` and fill in your details:
    ```bash
    cp .env.example .env.local
    ```
    - `DEEPSEEK_API_KEY`: Get from [DeepSeek Platform](https://platform.deepseek.com/).
    - `APP_USERNAME` / `APP_PASSWORD`: Set your desired login.
    - `JWT_SECRET_KEY`: Generate a random string (e.g., `openssl rand -hex 32`).

3.  **Run Development Server**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000).

4.  **Build for Production**
    ```bash
    npm run build
    npm start
    ```

## Vercel Deployment

1.  Push to GitHub.
2.  Import project in Vercel.
3.  Add Environment Variables in Vercel Project Settings.
4.  Deploy.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: TailwindCSS v4
- **Auth**: `jose` (JWT)
- **Icons**: `lucide-react`
- **Markdown**: `react-markdown`
