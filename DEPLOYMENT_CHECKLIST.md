# Quick Deployment Checklist

## Pre-Deployment

- [ ] All environment variables configured in `.env`
- [ ] Supabase project created and database migrations applied
- [ ] Database service role key retrieved
- [ ] Frontend environment variables set (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Git repository initialized and code pushed to GitHub

## Local Testing

- [ ] Docker and Docker Compose installed
- [ ] `docker-compose up` builds and runs successfully
- [ ] Frontend accessible at http://localhost:3000
- [ ] Backend API accessible at http://localhost:8000
- [ ] API docs at http://localhost:8000/docs working
- [ ] Login with Supabase auth working
- [ ] Face recognition endpoints tested

## Production Deployment

### Backend Service
- [ ] Platform account created (Render/Railway/Fly.io)
- [ ] Repository connected to platform
- [ ] Environment variables added:
  - SUPABASE_URL
  - SUPABASE_SERVICE_KEY
  - ALLOWED_ORIGINS (frontend URL)
  - MOCK_AI=false
  - FACE_THRESHOLD=0.5
  - SPOOF_THRESHOLD=0.70
- [ ] Service deployed successfully
- [ ] Health check endpoint (/health) responding
- [ ] API accessible at backend URL

### Frontend Deployment
- [ ] Build command: `npm --prefix frontend ci && npm --prefix frontend run build`
- [ ] Publish directory: `frontend/dist`
- [ ] Environment variables set:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY
  - VITE_API_URL (backend URL)
- [ ] Site deployed and accessible
- [ ] Frontend can connect to backend API
- [ ] All routes working

### Database
- [ ] All migrations applied on production database
- [ ] Row-level security policies enabled
- [ ] Service role key used only on backend
- [ ] Anon key used only on frontend

## Post-Deployment

- [ ] Test complete user flow:
  - [ ] Sign up with @ensia.edu.dz email
  - [ ] Verify OTP
  - [ ] Login
  - [ ] Access dashboard
  - [ ] Register student (if lecturer/admin)
  - [ ] Start attendance session
- [ ] Monitor backend logs for errors
- [ ] Check performance and uptime
- [ ] Set up error tracking/monitoring
- [ ] Enable HTTPS/SSL (should be automatic)

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Check ALLOWED_ORIGINS includes frontend URL |
| Cannot connect to API | Verify VITE_API_URL points to correct backend |
| Database errors | Check SUPABASE_URL and service key are correct |
| 502/503 errors | Check backend logs, may be cold start or out of memory |
| Login not working | Verify Supabase project settings and auth enabled |
| Faces not recognized | Check MOCK_AI=false, verify model files included |
