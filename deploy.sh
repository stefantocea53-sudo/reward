#!/bin/bash
# deploy.sh — script de deploy pentru recoreco pe Cloudflare Pages
# Rulează din directorul pages-deploy/

set -e

PROJECT="recoreco"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC="$DIR/public"

echo "======================================"
echo " recoreco — Cloudflare Pages Deploy"
echo "======================================"
echo ""

# Verifică wrangler
if ! command -v wrangler &> /dev/null; then
  echo "[!] wrangler nu e instalat. Rulează:"
  echo "    npm install -g wrangler"
  echo "    sau: npx wrangler login"
  exit 1
fi

# Verifică autentificare
echo "[*] Verifică autentificare Cloudflare..."
wrangler whoami || {
  echo "[!] Nu ești autentificat. Rulează: wrangler login"
  exit 1
}

echo ""
echo "[*] Deploy la proiectul: $PROJECT"
echo "[*] Folder public: $PUBLIC"
echo ""

# Deploy
npx wrangler pages deploy "$PUBLIC" \
  --project-name "$PROJECT" \
  --commit-message "deploy $(date -u +%Y-%m-%dT%H:%M:%SZ)"

echo ""
echo "[✓] Deploy complet!"
echo "[!] Înlocuiește RECO_AFFILIATE_LINK_AICI în public/config/config.js cu link-ul tău Reco"
echo "[!] Redeploy după ce schimbi config-ul"
