# Deploying to Railway

This guide will help you deploy the Anky server to Railway and point your custom domain `anky.app` to it.

## Prerequisites

- A Railway account (sign up at https://railway.app)
- Your API keys ready:
  - Anthropic API key (get from https://console.anthropic.com)
  - Gemini API key (get from https://aistudio.google.com/apikey)
  - (Optional) Pinata JWT for IPFS uploads (get from https://pinata.cloud)

## Step 1: Deploy to Railway

### Option A: Deploy from GitHub (Recommended)

1. Push your code to a GitHub repository
2. Go to https://railway.app
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your repository
6. Railway will automatically detect it's a Bun project and deploy it

### Option B: Deploy using Railway CLI

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login to Railway
railway login

# Initialize a new project
railway init

# Deploy
railway up
```

## Step 2: Set Environment Variables

In your Railway project dashboard:

1. Go to the "Variables" tab
2. Add the following environment variables:

```
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
PINATA_JWT=your_pinata_jwt_here  # Optional
```

**Important:** Do NOT set the `PORT` variable - Railway automatically provides it.

## Step 3: Configure Custom Domain

1. In your Railway project, go to the "Settings" tab
2. Scroll down to "Domains"
3. Click "Add Domain"
4. Enter your domain: `anky.app`
5. Railway will provide you with DNS records to add

## Step 4: Update DNS Records

Go to your domain registrar (where you bought `anky.app`) and add the DNS records provided by Railway:

**For root domain (anky.app):**
- Type: `A` or `CNAME` (Railway will tell you which one)
- Name: `@`
- Value: (the value Railway provides)

**For www subdomain (optional):**
- Type: `CNAME`
- Name: `www`
- Value: (the value Railway provides)

## Step 5: Wait for Propagation

DNS changes can take up to 48 hours to propagate, but usually take 5-30 minutes.

You can check the status with:
```bash
dig anky.app
```

## Step 6: Verify Deployment

Once DNS has propagated:

1. Visit https://anky.app
2. You should see your Anky writing interface
3. Test the writing feature to make sure the API keys are working

## Troubleshooting

### Build Fails

If the build fails, check:
- Railway is using Bun (not Node.js) in the build settings
- All required files are committed to git

### API Keys Not Working

- Make sure you've set the environment variables in Railway
- Check the Railway logs for any error messages
- Verify your API keys are valid

### Domain Not Working

- Wait longer for DNS propagation (can take up to 48 hours)
- Use `dig anky.app` to check DNS records
- Make sure you've added the correct DNS records at your registrar

### Server Crashes

- Check Railway logs for error messages
- Ensure all dependencies are installed
- Verify the start command is correct: `bun run start`

## Managing Your Deployment

### View Logs
In Railway dashboard, click on your deployment and go to the "Logs" tab.

### Redeploy
Railway automatically redeploys when you push to your connected GitHub repository.

### Environment Variables
You can update environment variables in the "Variables" tab. The app will automatically restart.

### Rollback
In the "Deployments" tab, you can rollback to a previous deployment if needed.

## Cost

Railway offers:
- $5/month of free usage for all users
- After that, you pay for what you use

The Anky server should stay well within the free tier for moderate usage.

## Support

If you encounter issues:
- Check Railway's documentation: https://docs.railway.app
- Check Railway's Discord: https://discord.gg/railway
- Check the Railway logs for error messages
