#!/usr/bin/env bash
# Publica la rama preview (la copia de prueba de v2) en GitHub Pages.
# El repo Bordes-v2 tiene Pages en modo clásico (rama gh-pages), así que
# basta con compilar y empujar el dist a esa rama.
#
#   ./scripts/publish-preview.sh
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

REPO="${REPO:-indar-vault/Bordes-v2}"
SITE="${REPO#*/}"
BASE_PATH="${BASE_PATH:-/${SITE}/}" npm run build

tmp="$(mktemp -d)"
cp -a dist/. "$tmp"
cd "$tmp"
git init -q
git add -A
git commit -q -m "preview $(git -C "$root" rev-parse --short HEAD)"
git push -f "https://github.com/${REPO}.git" HEAD:gh-pages
echo "Publicado en https://indar-vault.github.io/${SITE}/"
