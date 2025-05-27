#!/bin/bash
set -e

REPO_URL="https://github.com/cptcr/pegasus"
PROJECT_DIR="pegasus"

# Utility to generate secrets
generate_secret() {
  openssl rand -base64 32
}

prompt_var() {
  local var_name="$1"
  local description="$2"
  local default_value="$3"
  local value

  echo
  echo "$description"
  read -p "$var_name [default: $default_value]: " value
  echo "${value:-$default_value}"
}

# Clone project
echo "Cloning Pegasus repository..."
git clone $REPO_URL
cd "$PROJECT_DIR"

echo "Filling out root .env file..."
ROOT_ENV=".env"
cp .env.example "$ROOT_ENV"

# Fill root .env
DATABASE_URL=$(prompt_var "DATABASE_URL" "PostgreSQL connection string" "postgresql://user:pass@localhost:5432/mydb")
DISCORD_BOT_TOKEN=$(prompt_var "DISCORD_BOT_TOKEN" "Discord bot token from https://discord.com/developers/applications" "")
DISCORD_CLIENT_ID=$(prompt_var "DISCORD_CLIENT_ID" "Discord client ID" "")
DISCORD_CLIENT_SECRET=$(prompt_var "DISCORD_CLIENT_SECRET" "Discord client secret" "")
NEXTAUTH_URL=$(prompt_var "NEXTAUTH_URL" "Dashboard public URL" "http://localhost:3001")
NEXTAUTH_SECRET=$(generate_secret)
ADMIN_USER_ID=$(prompt_var "ADMIN_USER_ID" "Your Discord user ID (admin access)" "")
TARGET_GUILD_ID=$(prompt_var "TARGET_GUILD_ID" "Main Discord server (guild) ID" "")
PORT=3000
DASHBOARD_PORT=3001

# Replace vars in .env
sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"$DATABASE_URL\"|" "$ROOT_ENV"
sed -i "s|^DISCORD_BOT_TOKEN=.*|DISCORD_BOT_TOKEN=\"$DISCORD_BOT_TOKEN\"|" "$ROOT_ENV"
sed -i "s|^DISCORD_CLIENT_ID=.*|DISCORD_CLIENT_ID=\"$DISCORD_CLIENT_ID\"|" "$ROOT_ENV"
sed -i "s|^DISCORD_CLIENT_SECRET=.*|DISCORD_CLIENT_SECRET=\"$DISCORD_CLIENT_SECRET\"|" "$ROOT_ENV"
sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=\"$NEXTAUTH_URL\"|" "$ROOT_ENV"
sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=\"$NEXTAUTH_SECRET\"|" "$ROOT_ENV"
sed -i "s|^ADMIN_USER_ID=.*|ADMIN_USER_ID=\"$ADMIN_USER_ID\"|" "$ROOT_ENV"
sed -i "s|^TARGET_GUILD_ID=.*|TARGET_GUILD_ID=\"$TARGET_GUILD_ID\"|" "$ROOT_ENV"

echo "Root .env setup complete."

# Dashboard .env
echo "Filling out dashboard/.env file..."
cp dashboard/.env.example dashboard/.env
DASHBOARD_ENV="dashboard/.env"

sed -i "s|^DISCORD_BOT_TOKEN=.*|DISCORD_BOT_TOKEN=$DISCORD_BOT_TOKEN|" "$DASHBOARD_ENV"
sed -i "s|^DISCORD_CLIENT_ID=.*|DISCORD_CLIENT_ID=$DISCORD_CLIENT_ID|" "$DASHBOARD_ENV"
sed -i "s|^DISCORD_CLIENT_SECRET=.*|DISCORD_CLIENT_SECRET=$DISCORD_CLIENT_SECRET|" "$DASHBOARD_ENV"
sed -i "s|^TARGET_GUILD_ID=.*|TARGET_GUILD_ID=$TARGET_GUILD_ID|" "$DASHBOARD_ENV"
sed -i "s|^NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEXTAUTH_URL|" "$DASHBOARD_ENV"
sed -i "s|^NEXTAUTH_SECRET=.*|NEXTAUTH_SECRET=$NEXTAUTH_SECRET|" "$DASHBOARD_ENV"

echo "Dashboard .env setup complete."

# Install npm packages
echo "Installing dependencies..."
npm install
cd dashboard && npm install && cd ..

# Prisma setup
echo "Running Prisma for root and dashboard..."
npx prisma generate
npx prisma migrate dev --name init || true
cd dashboard
npx prisma generate
npx prisma migrate dev --name init || true
cd ..

# nginx config
echo "Configuring nginx..."
NGINX_CONF="/etc/nginx/sites-available/pegasus"
sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/pegasus
sudo nginx -t && sudo systemctl reload nginx

# Cloudflare Tunnel
echo "Setting up Cloudflare Tunnel..."
echo "Ensure cloudflared is authenticated (run: cloudflared login)"
read -p "Enter your custom domain for Cloudflare Tunnel (e.g. pegasus.example.com): " CUSTOM_DOMAIN

cloudflared tunnel create pegasus-tunnel
TUNNEL_ID=$(cloudflared tunnel list | grep pegasus-tunnel | awk '{print $1}')
mkdir -p ~/.cloudflared

cat > ~/.cloudflared/config.yml <<EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/${TUNNEL_ID}.json

ingress:
  - hostname: $CUSTOM_DOMAIN
    service: http://localhost:3001
  - service: http_status:404
EOF

cloudflared tunnel route dns pegasus-tunnel "$CUSTOM_DOMAIN"
cloudflared tunnel run pegasus-tunnel &

# Start server
echo "Launching dashboard on port 3001..."
cd dashboard
PORT=3001 WS_PORT=3002 npm run dev &
cd ..

echo "✅ Pegasus setup complete!"
echo "🌐 Access it at: https://$CUSTOM_DOMAIN"
