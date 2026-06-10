#!/bin/bash
# Run on the production server: cd /var/www/AIImageGenerator && ./deploy.sh
set -e

git pull
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart snap6-app --update-env
