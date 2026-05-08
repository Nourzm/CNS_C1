# FaceGuard Deployment Guide

This guide covers deploying FaceGuard to free platforms.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) installed locally
- [Supabase](https://supabase.com) project set up with database migrated
- Copy `.env.example` to `.env` with your configuration

## Local Development with Docker

### 1. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 2. Build and Run

```bash
docker-compose up --build
```

- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## Production Deployment Options

### Option 1: Render.com (Recommended)

**Pros**: Free tier, easy GitHub integration, good for this stack
**Cost**: Free tier includes 2 background workers

#### Steps:

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add Docker deployment files"
   git push origin main
   ```

2. **Deploy Backend on Render**
   - Go to https://render.com
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Set build command: `docker build -f Dockerfile.backend -t backend .`
   - Set start command: `uvicorn backend.app:app --host 0.0.0.0 --port 8000`
   - Add environment variables:
     ```
     SUPABASE_URL=your-url
     SUPABASE_SERVICE_KEY=your-key
     SUPABASE_ANON_KEY=your-anon-key
     ALLOWED_ORIGINS=your-frontend-url.onrender.com
     MOCK_AI=false
     ```
   - Leave as Free tier or upgrade for better reliability

3. **Deploy Frontend on Render**
   - Click "New" → "Static Site"
   - Connect same GitHub repository
   - Build command: `npm --prefix frontend ci && npm --prefix frontend run build`
   - Publish directory: `frontend/dist`
   - Add environment variable:
     ```
     VITE_API_URL=https://backend-url.onrender.com
     VITE_SUPABASE_URL=your-url
     VITE_SUPABASE_ANON_KEY=your-anon-key
     ```

### Option 2: Railway.app

**Pros**: Simple deployment, free credit ($5/month), Docker support
**Cost**: Free $5 credit per month

#### Steps:

1. **Install Railway CLI**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login and Initialize**
   ```bash
   railway login
   railway init
   ```

3. **Configure Backend Service**
   ```bash
   railway service add # Add a new service
   ```
   - Select "Docker" as the template
   - Set the Dockerfile to `Dockerfile.backend`

4. **Set Environment Variables**
   ```bash
   railway variables add SUPABASE_URL=your-url
   railway variables add SUPABASE_SERVICE_KEY=your-key
   # ... add other variables
   ```

5. **Deploy**
   ```bash
   railway up
   ```

6. **Deploy Frontend**
   - Push to GitHub
   - Connect Railway to GitHub
   - Configure to build `frontend` and serve from `dist`

### Option 3: Fly.io

**Pros**: Global deployment, generous free tier
**Cost**: Free with credit system

#### Steps:

1. **Install Fly CLI**
   ```bash
   curl https://fly.io/install.sh | sh
   ```

2. **Login**
   ```bash
   flyctl auth login
   ```

3. **Create Apps**
   ```bash
   # Backend
   flyctl launch --name cns-backend --dockerfile Dockerfile.backend
   
   # Frontend
   flyctl launch --name cns-frontend --dockerfile Dockerfile.frontend
   ```

4. **Set Secrets**
   ```bash
   flyctl secrets set SUPABASE_URL=your-url SUPABASE_SERVICE_KEY=your-key
   ```

5. **Deploy**
   ```bash
   flyctl deploy
   ```

## Database Migrations

After deployment, run migrations on Supabase:

```bash
# Using Supabase CLI
supabase db push

# Or manually run SQL files from supabase/migrations/ directory
```

## Monitoring & Logs

- **Render**: Dashboard shows logs and metrics
- **Railway**: `railway logs` in CLI
- **Fly.io**: `flyctl logs` in CLI

## Important Notes

⚠️ **Free Tier Limitations**:
- Cold starts may cause 50+ second delays
- Limited CPU/RAM
- Supabase free tier has 500MB storage
- No custom domain on free tier (use provided URLs)

## Troubleshooting

### Backend won't start
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are set correctly
- Verify database migrations are applied
- Check logs for specific errors

### CORS errors
- Update `ALLOWED_ORIGINS` environment variable with your frontend URL
- Format: `https://yourdomain.onrender.com,https://yourdomain.onrender.com`

### Frontend can't connect to API
- Update `VITE_API_URL` to your backend URL
- Ensure backend is running and accessible
- Check browser console for specific errors

### Out of memory during build
- Use Render's performance tier
- Or split into multiple services
- Consider using lighter base images

## Next Steps After Deployment

1. **Add custom domain** (paid tier required)
2. **Set up SSL certificate** (auto-included on paid tiers)
3. **Configure backup strategy** for Supabase
4. **Set up monitoring** alerts
5. **Enable analytics** on frontend
6. **Set up CI/CD pipeline** for automatic deployments on git push

## Further Resources

- [Render Documentation](https://render.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Fly.io Documentation](https://fly.io/docs)
- [Supabase Deployment](https://supabase.com/docs/guides/hosting)
