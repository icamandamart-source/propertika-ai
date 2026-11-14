#!/bin/bash
# Propertika AI Deployment Helper
# Usage: ./scripts/deploy.sh [render|railway|docker] [--skip-build] [--verify-only]

set -e

TARGET="${1:-render}"
SKIP_BUILD=false
VERIFY_ONLY=false

for arg in "$@"; do
    case $arg in
        --skip-build) SKIP_BUILD=true ;;
        --verify-only) VERIFY_ONLY=true ;;
    esac
done

echo -e "\033[1;36m🚀 Propertika AI Deployment Helper\033[0m"
echo -e "\033[1;33mTarget: $TARGET\033[0m\n"

# --- Pre-flight checks ---
echo -e "\033[90m🔍 Checking prerequisites...\033[0m"

check_cmd() {
    local name=$1
    local cmd=$2
    local pattern=$3
    
    if output=$(eval "$cmd" 2>&1); then
        if [[ $output =~ $pattern ]]; then
            echo -e "  \033[32m✅ $name: ${BASH_REMATCH[0]}\033[0m"
        else
            echo -e "  \033[33m⚠️  $name: $output\033[0m"
        fi
    else
        echo -e "  \033[31m❌ $name: NOT FOUND\033[0m"
        MISSING_PREREQS=true
    fi
}

MISSING_PREREQS=false
check_cmd "Node.js 20+" "node --version" "v2[0-9]\."
check_cmd "npm" "npm --version" "[0-9]+"
check_cmd "Git" "git --version" "git version"
check_cmd "Docker" "docker --version" "Docker version"

if [[ "$MISSING_PREREQS" == "true" ]]; then
    echo -e "\n\033[31m❌ Missing prerequisites. Install them first.\033[0m"
    exit 1
fi

# --- Verify .env ---
echo -e "\n\033[90m🔍 Checking environment configuration...\033[0m"
FOUND_ENV=false
for file in .env .env.local .env.production; do
    if [[ -f "$file" ]]; then
        echo -e "  \033[32m✅ Found: $file\033[0m"
        FOUND_ENV=true
    fi
done

if [[ "$FOUND_ENV" == "false" ]]; then
    echo -e "  \033[33m⚠️  No .env file found. Copy from .env.production.template or .env.local.template\033[0m"
    echo -e "  \033[33mRequired for production: FIREBASE_SERVICE_ACCOUNT, CLOUDFLARE_*, CLOUDINARY_*\033[0m"
fi

# --- Git status ---
echo -e "\n\033[90m📦 Git status...\033[0m"
STATUS=$(git status --porcelain 2>&1)
if [[ -n "$STATUS" ]]; then
    echo -e "  \033[33m⚠️  Uncommitted changes:\033[0m"
    echo "$STATUS" | sed 's/^/    /'
    echo -e "  \033[33mCommit or stash before deploy!\033[0m"
else
    echo -e "  \033[32m✅ Working tree clean\033[0m"
fi

BRANCH=$(git branch --show-current)
echo -e "  Branch: $BRANCH"

REMOTE=$(git remote get-url origin 2>&1 || true)
if [[ "$REMOTE" =~ github\.com ]]; then
    echo -e "  \033[32mRemote: $REMOTE\033[0m"
else
    echo -e "  \033[33m⚠️  No GitHub remote found. Push to GitHub first for Render/Railway.\033[0m"
fi

# --- Run tests ---
if [[ "$SKIP_BUILD" != "true" && "$VERIFY_ONLY" != "true" ]]; then
    echo -e "\n\033[90m🧪 Running tests...\033[0m"
    
    echo -n "  Typecheck... "
    if npm run typecheck > /dev/null 2>&1; then
        echo -e "\033[32m✅\033[0m"
    else
        echo -e "\033[31m❌\033[0m"
        npm run typecheck
        exit 1
    fi
    
    echo -n "  Unit tests... "
    if npm test > /dev/null 2>&1; then
        echo -e "\033[32m✅\033[0m"
    else
        echo -e "\033[31m❌\033[0m"
        npm test
        exit 1
    fi
    
    echo -n "  Build... "
    if npm run build > /dev/null 2>&1; then
        echo -e "\033[32m✅\033[0m"
    else
        echo -e "\033[31m❌\033[0m"
        npm run build
        exit 1
    fi
fi

# --- Docker build test ---
if [[ "$TARGET" == "docker" ]]; then
    echo -e "\n\033[90m🐳 Testing Docker build...\033[0m"
    if docker build -t propertika-ai:test . > /dev/null 2>&1; then
        echo -e "  \033[32m✅ Docker build successful\033[0m"
        
        echo -e "  \033[90m🧪 Testing container startup...\033[0m"
        CID=$(docker run -d -p 3001:3000 --env-file .env.local propertika-ai:test 2>&1)
        if [[ $? -eq 0 ]]; then
            sleep 5
            if curl -sf http://localhost:3001/api/health > /dev/null 2>&1; then
                echo -e "  \033[32m✅ Health check passed\033[0m"
            else
                echo -e "  \033[33m⚠️  Health check failed (may need proper env)\033[0m"
            fi
            docker stop "$CID" > /dev/null
            docker rm "$CID" > /dev/null
        fi
    else
        echo -e "  \033[31m❌ Docker build failed\033[0m"
        docker build -t propertika-ai:test .
        exit 1
    fi
fi

# --- Deploy instructions ---
echo -e "\n============================================================"
echo -e "\033[1;36m📋 DEPLOYMENT INSTRUCTIONS FOR ${TARGET^^}\033[0m"
echo -e "============================================================"

case $TARGET in
    render)
        cat << 'EOF'
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
EOF
        ;;
    railway)
        cat << 'EOF'
1. Push ke GitHub:
   git push origin main

2. Buka https://railway.app → New Project → Deploy from GitHub
   → Select propertika-ai repo

3. Railway otomatis detect railway.json dan Dockerfile

4. Di Variables tab, tambahkan semua env vars (dari .env.production.template)

5. Deploy otomatis jalan. Tunggu selesai.

6. Domain: Settings → Domains → Generate Domain atau Custom Domain

7. Verifikasi health check.
EOF
        ;;
    docker)
        cat << 'EOF'
1. Build image:
   docker build -t propertika-ai .

2. Run lokal dengan .env.local:
   docker run -d -p 3000:3000 --env-file .env.local propertika-ai

3. Push ke registry (Docker Hub, GHCR, ECR, dll):
   docker tag propertika-ai your-registry/propertika-ai:latest
   docker push your-registry/propertika-ai:latest

4. Deploy ke VPS/K8s/Cloud Run dengan image tersebut.
EOF
        ;;
esac

echo -e "\n\033[32m✅ Preparation complete!\033[0m"
echo -e "\033[36mNext: Follow instructions above for $TARGET deployment.\033[0m\n"