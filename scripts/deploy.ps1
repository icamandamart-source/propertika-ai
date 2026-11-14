<# 
.SYNOPSIS
    Deploy Propertika AI to Render or Railway

.DESCRIPTION
    Script bantuan untuk mempersiapkan dan memverifikasi deployment.
    Jalankan dari root project: .\scripts\deploy.ps1

.NOTES
    Butuh: Docker, Git, akses ke GitHub, akun Render/Railway
#>

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet('render', 'railway', 'docker')]
    [string]$Target = 'render',

    [Parameter(Mandatory=$false)]
    [switch]$SkipBuild,

    [Parameter(Mandatory=$false)]
    [switch]$VerifyOnly
)

Write-Host "🚀 Propertika AI Deployment Helper" -ForegroundColor Cyan
Write-Host "Target: $Target`n" -ForegroundColor Yellow

# --- Pre-flight checks ---
function Check-Prerequisites {
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Gray
    
    $checks = @(
        @{ Name = 'Node.js 20+'; Cmd = 'node --version'; Pattern = 'v2[0-9]\.' },
        @{ Name = 'npm'; Cmd = 'npm --version'; Pattern = '\d+' },
        @{ Name = 'Git'; Cmd = 'git --version'; Pattern = 'git version' },
        @{ Name = 'Docker'; Cmd = 'docker --version'; Pattern = 'Docker version' }
    )
    
    foreach ($check in $checks) {
        try {
            $output = & $check.Cmd 2>&1
            if ($output -match $check.Pattern) {
                Write-Host "  ✅ $($check.Name): $($matches[0])" -ForegroundColor Green
            } else {
                Write-Host "  ⚠️  $($check.Name): $output" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "  ❌ $($check.Name): NOT FOUND" -ForegroundColor Red
            $global:missingPrereqs = $true
        }
    }
    
    if ($global:missingPrereqs) {
        Write-Host "`n❌ Missing prerequisites. Install them first." -ForegroundColor Red
        exit 1
    }
}

# --- Verify .env exists ---
function Check-EnvFile {
    Write-Host "`n🔍 Checking environment configuration..." -ForegroundColor Gray
    
    $envFiles = @('.env', '.env.local', '.env.production')
    $found = $false
    
    foreach ($file in $envFiles) {
        if (Test-Path $file) {
            Write-Host "  ✅ Found: $file" -ForegroundColor Green
            $found = $true
        }
    }
    
    if (-not $found) {
        Write-Host "  ⚠️  No .env file found. Copy from .env.production.template or .env.local.template" -ForegroundColor Yellow
        Write-Host "  Required for production: FIREBASE_SERVICE_ACCOUNT, CLOUDFLARE_*, CLOUDINARY_*" -ForegroundColor Yellow
    }
}

# --- Run tests ---
function Run-Tests {
    if ($SkipBuild) { return }
    
    Write-Host "`n🧪 Running tests..." -ForegroundColor Gray
    
    Write-Host "  Typecheck..." -NoNewline
    $result = npm run typecheck 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host " ✅" -ForegroundColor Green }
    else { Write-Host " ❌"; Write-Host $result; exit 1 }
    
    Write-Host "  Unit tests..." -NoNewline
    $result = npm test 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host " ✅" -ForegroundColor Green }
    else { Write-Host " ❌"; Write-Host $result; exit 1 }
    
    Write-Host "  Build..." -NoNewline
    $result = npm run build 2>&1
    if ($LASTEXITCODE -eq 0) { Write-Host " ✅" -ForegroundColor Green }
    else { Write-Host " ❌"; Write-Host $result; exit 1 }
}

# --- Docker build test ---
function Test-DockerBuild {
    if ($Target -ne 'docker') { return }
    
    Write-Host "`n🐳 Testing Docker build..." -ForegroundColor Gray
    $result = docker build -t propertika-ai:test . 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Docker build successful" -ForegroundColor Green
        
        # Test run container
        Write-Host "  🧪 Testing container startup..." -ForegroundColor Gray
        $cid = docker run -d -p 3001:3000 --env-file .env.local propertika-ai:test 2>&1
        if ($LASTEXITCODE -eq 0) {
            Start-Sleep 5
            try {
                $health = Invoke-WebRequest -Uri 'http://localhost:3001/api/health' -TimeoutSec 10 -ErrorAction Stop
                if ($health.StatusCode -eq 200) {
                    Write-Host "  ✅ Health check passed" -ForegroundColor Green
                }
            } catch {
                Write-Host "  ⚠️  Health check failed (may need proper env)" -ForegroundColor Yellow
            }
            docker stop $cid > $null
            docker rm $cid > $null
        }
    } else {
        Write-Host "  ❌ Docker build failed" -ForegroundColor Red
        Write-Host $result
        exit 1
    }
}

# --- Git status ---
function Check-GitStatus {
    Write-Host "`n📦 Git status..." -ForegroundColor Gray
    $status = git status --porcelain 2>&1
    if ($status) {
        Write-Host "  ⚠️  Uncommitted changes:" -ForegroundColor Yellow
        $status | ForEach-Object { Write-Host "    $_" }
        Write-Host "  Commit or stash before deploy!" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Working tree clean" -ForegroundColor Green
    }
    
    $branch = git branch --show-current
    Write-Host "  Branch: $branch"
    
    $remote = git remote get-url origin 2>&1
    if ($remote -match 'github\.com') {
        Write-Host "  Remote: $remote" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  No GitHub remote found. Push to GitHub first for Render/Railway." -ForegroundColor Yellow
    }
}

# --- Deploy instructions ---
function Show-DeployInstructions {
    Write-Host "`n" + "="*60
    Write-Host "📋 DEPLOYMENT INSTRUCTIONS FOR $($Target.ToUpper())" -ForegroundColor Cyan
    Write-Host "="*60
    
    if ($Target -eq 'render') {
        @"
1. Push ke GitHub:
   git push origin main

2. Buka https://dashboard.render.com/blueprints
   → "New Blueprint Instance"
   → Connect repository propertika-ai

3. Isi Environment Variables (dari .env.production.template):
   REQUIRED:
   - VITE_FIREBASE_* (6 variabel)
   - FIREBASE_SERVICE_ACCOUNT (one-line JSON)
   - CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN
   - CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
   
   OPTIONAL:
   - MIDTRANS_SERVER_KEY, MIDTRANS_IS_PRODUCTION, APP_URL
   - GEMINI_API_KEY
   - VITE_FIREBASE_APP_CHECK_SITE_KEY, APP_CHECK_REQUIRED

4. Klik "Apply" → Tunggu deploy selesai (~5-10 menit)

5. Setelah deploy, catat URL: https://your-app.onrender.com
   → Update APP_URL di Environment Variables
   → Redeploy

6. Setup Custom Domain (Settings → Custom Domains)
   → Update Firebase Auth authorized domains
   → Update App Check domains
   → Enable APP_CHECK_REQUIRED=true

7. Verifikasi: curl https://your-app.onrender.com/api/health
"@
    } elseif ($Target -eq 'railway') {
        @"
1. Push ke GitHub:
   git push origin main

2. Buka https://railway.app → New Project → Deploy from GitHub
   → Select propertika-ai repo

3. Railway otomatis detect railway.json dan Dockerfile

4. Di Variables tab, tambahkan semua env vars (dari .env.production.template)

5. Deploy otomatis jalan. Tunggu selesai.

6. Domain: Settings → Domains → Generate Domain atau Custom Domain

7. Verifikasi health check.
"@
    } elseif ($Target -eq 'docker') {
        @"
1. Build image:
   docker build -t propertika-ai .

2. Run lokal dengan .env.local:
   docker run -d -p 3000:3000 --env-file .env.local propertika-ai

3. Push ke registry (Docker Hub, GHCR, ECR, dll):
   docker tag propertika-ai your-registry/propertika-ai:latest
   docker push your-registry/propertika-ai:latest

4. Deploy ke VPS/K8s/Cloud Run dengan image tersebut.
"@
    }
}

# --- Main ---
Check-Prerequisites
Check-EnvFile
Check-GitStatus

if (-not $VerifyOnly) {
    Run-Tests
    Test-DockerBuild
}

Show-DeployInstructions

Write-Host "`n✅ Preparation complete!" -ForegroundColor Green
Write-Host "Next: Follow instructions above for $Target deployment.`n" -ForegroundColor Cyan