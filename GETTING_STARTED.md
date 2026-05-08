# FaceGuard Deployment - Getting Started

## 📋 Overview

I've prepared your project for deployment with:
- ✅ Docker containerization for both backend and frontend
- ✅ Local development setup with docker-compose
- ✅ Deployment guides for free platforms (Render, Railway, Fly.io)
- ✅ Environment configuration template
- ✅ CI/CD pipeline with GitHub Actions

## 🚀 Quick Start (5 minutes)

### 1. Test Locally First

```bash
# Create environment file
cp .env.example .env

# Edit .env with your Supabase credentials:
# - Get SUPABASE_URL and keys from https://app.supabase.com
```

```bash
# Run locally with Docker
docker-compose up --build
```

Visit:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### 2. Push to GitHub

```bash
git add .
git commit -m "Add Docker and deployment configuration"
git push origin main
```

### 3. Choose Your Free Platform

| Platform | Setup Time | Best For | Free Tier |
|----------|-----------|----------|-----------|
| **Render** | 10 min | Static + Backend | 2 free services |
| **Railway** | 8 min | Full stack | $5/month credit |
| **Fly.io** | 10 min | Global apps | Generous free tier |

## 🎯 Recommended: Render.com (Easiest)

### Backend Deployment (5 minutes)

1. Go to https://render.com and sign up
2. Click **New** → **Web Service**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `cns-backend`
   - **Build Command**: Leave empty (use Dockerfile)
   - **Start Command**: Leave empty (use Dockerfile)
   - **Dockerfile Path**: `Dockerfile.backend`
   - **Exposed Port**: `8000`
5. Click **Advanced** and add Environment Variables:
   ```
   SUPABASE_URL = your-supabase-url
   SUPABASE_SERVICE_KEY = your-service-key
   ALLOWED_ORIGINS = your-frontend-url.onrender.com
   MOCK_AI = false
   ```
6. Click **Deploy**
7. Copy your backend URL (looks like: `https://cns-backend.onrender.com`)

### Frontend Deployment (5 minutes)

1. On Render, click **New** → **Static Site**
2. Connect same GitHub repository
3. Configure:
   - **Name**: `cns-frontend`
   - **Build Command**: `npm --prefix frontend ci && npm --prefix frontend run build`
   - **Publish Directory**: `frontend/dist`
4. Click **Advanced** and add Environment Variables:
   ```
   VITE_SUPABASE_URL = your-supabase-url
   VITE_SUPABASE_ANON_KEY = your-anon-key
   VITE_API_URL = https://cns-backend.onrender.com
   ```
5. Click **Deploy**

### Database Setup

Run migrations on your Supabase database:

```bash
# Using Supabase CLI
npm install -g supabase
supabase db push

# Or manually apply each SQL file from supabase/migrations/ folder
```

## 📁 What Each File Does

```
Dockerfile.backend       → Builds optimized Python backend image
Dockerfile.frontend      → Builds optimized React frontend image
docker-compose.yml       → Local dev setup with both services
.env.example            → Template for environment variables
.dockerignore           → Optimizes Docker builds
render.yaml             → Render-specific config (optional)
deploy.sh               → Quick setup script
DEPLOYMENT.md           → Detailed deployment guides
DEPLOYMENT_CHECKLIST.md → Pre/post deployment checklist
.github/workflows/      → Automated CI/CD pipeline
```

## 🔑 Environment Variables Explained

### Backend (.env)
```
SUPABASE_URL              → Your Supabase project URL
SUPABASE_SERVICE_KEY      → Service role key (backend only!)
ALLOWED_ORIGINS           → Frontend URL (prevents CORS errors)
MOCK_AI                   → false for real AI, true for testing
FACE_THRESHOLD            → Confidence level for face matches (0-1)
SPOOF_THRESHOLD           → Anti-spoofing sensitivity (0-1)
```

### Frontend (Environment Variables)
```
VITE_SUPABASE_URL         → Your Supabase project URL
VITE_SUPABASE_ANON_KEY    → Anon key (safe for frontend!)
VITE_API_URL              → Backend URL (e.g., https://cns-backend.onrender.com)
```

## ⚠️ Important Notes

1. **Database Migrations**: Must be applied manually on production Supabase
2. **Free Tier Limits**:
   - May have 50+ second cold starts
   - Limited CPU/RAM
   - Supabase free: 500MB storage
3. **Service Key Security**: Never expose in frontend or GitHub
4. **CORS Setup**: Update ALLOWED_ORIGINS with your actual frontend URL
5. **SSL/HTTPS**: Automatic on Render, Railway, and Fly.io

## 🧪 Testing the Deployment

After deployment, test:
1. ✅ Frontend loads at your public URL
2. ✅ Can access http://backend-url/docs (API docs)
3. ✅ Login page works with Supabase
4. ✅ Can navigate dashboard (if logged in as admin/lecturer)
5. ✅ API calls succeed (check browser console for errors)

## 📊 Monitoring

Each platform provides logs:
- **Render**: Dashboard → Service → Logs
- **Railway**: `railway logs` in terminal
- **Fly.io**: `flyctl logs` in terminal

Check logs if you see:
- 502/503 errors → Cold start or out of memory
- CORS errors → Check ALLOWED_ORIGINS
- Database errors → Check Supabase credentials

## ❓ Troubleshooting

### Frontend shows "Cannot connect to API"
→ Check `VITE_API_URL` matches your backend URL

### Login doesn't work
→ Verify Supabase auth is enabled in project settings

### Face recognition returns empty
→ Check `MOCK_AI=false` in backend env vars

### Database connection fails
→ Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct

## 📚 Next Steps

1. **Get Supabase Credentials**:
   - Go to https://app.supabase.com
   - Create a project
   - Go to Settings → API
   - Copy the values

2. **Test Locally**:
   ```bash
   cp .env.example .env
   # Edit .env with Supabase values
   docker-compose up
   ```

3. **Deploy to Render**:
   - Follow the "Recommended: Render.com" section above
   - Takes about 15 minutes total

4. **Run Migrations**:
   ```bash
   supabase db push
   ```

5. **Test the Deployed App**:
   - Visit your frontend URL
   - Test login, dashboard, and face registration

## 💬 Still Need Help?

See detailed guides:
- `DEPLOYMENT.md` - Full platform-by-platform guides
- `DEPLOYMENT_CHECKLIST.md` - Pre/post deployment checks
- Platform docs: [Render](https://render.com/docs) | [Railway](https://docs.railway.app) | [Fly.io](https://fly.io/docs)
