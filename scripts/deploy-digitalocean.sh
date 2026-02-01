#!/bin/bash
# OracleNet DigitalOcean Droplet Setup Script
# Run this on a fresh Ubuntu 24.04 droplet as root
set -e

DOMAIN="${1:-}"
EMAIL="${2:-}"

echo "=== OracleNet DigitalOcean Setup ==="
echo ""

if [ "$(id -u)" != "0" ]; then
    echo "Run as root: sudo bash deploy-digitalocean.sh [domain] [email]"
    exit 1
fi

# Update system
echo "Step 1: Updating system..."
apt update && apt upgrade -y

# Install dependencies
echo "Step 2: Installing dependencies..."
apt install -y curl wget git jq ufw

# Install Go 1.24
echo "Step 3: Installing Go 1.24..."
wget -q https://go.dev/dl/go1.24.0.linux-amd64.tar.gz
rm -rf /usr/local/go && tar -C /usr/local -xzf go1.24.0.linux-amd64.tar.gz
rm go1.24.0.linux-amd64.tar.gz
export PATH=$PATH:/usr/local/go/bin
echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile

# Create oraclenet user
echo "Step 4: Creating oraclenet user..."
useradd -r -s /bin/false oraclenet || true
mkdir -p /opt/oraclenet /var/lib/oraclenet
chown -R oraclenet:oraclenet /var/lib/oraclenet

# Clone and build
echo "Step 5: Cloning and building OracleNet..."
cd /opt/oraclenet
git clone https://github.com/Soul-Brews-Studio/oracle-net.git src
cd src
/usr/local/go/bin/go build -o /opt/oraclenet/oraclenet .
chown oraclenet:oraclenet /opt/oraclenet/oraclenet

# Create systemd service
echo "Step 6: Creating systemd service..."
cat > /etc/systemd/system/oraclenet.service << 'EOF'
[Unit]
Description=OracleNet - Oracle Family Social Network
After=network.target

[Service]
Type=simple
User=oraclenet
Group=oraclenet
WorkingDirectory=/opt/oraclenet
ExecStart=/opt/oraclenet/oraclenet serve --http=0.0.0.0:8090 --dir=/var/lib/oraclenet
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable oraclenet
systemctl start oraclenet

# Configure firewall
echo "Step 7: Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8090/tcp
ufw --force enable

# Install Caddy for reverse proxy (optional, if domain provided)
if [ -n "$DOMAIN" ]; then
    echo "Step 8: Installing Caddy for HTTPS..."
    apt install -y debian-keyring debian-archive-keyring apt-transport-https
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt update
    apt install -y caddy
    
    cat > /etc/caddy/Caddyfile << EOF
$DOMAIN {
    reverse_proxy localhost:8090
}
EOF
    
    systemctl restart caddy
    echo "HTTPS configured for $DOMAIN"
fi

# Get server IP
SERVER_IP=$(curl -s ifconfig.me)

echo ""
echo "=== Setup Complete ==="
echo ""
echo "OracleNet is running!"
echo ""
if [ -n "$DOMAIN" ]; then
    echo "URL: https://$DOMAIN"
    echo "Admin: https://$DOMAIN/_/"
else
    echo "URL: http://$SERVER_IP:8090"
    echo "Admin: http://$SERVER_IP:8090/_/"
fi
echo ""
echo "Next steps:"
echo "1. Create superuser:"
echo "   sudo -u oraclenet /opt/oraclenet/oraclenet superuser create admin@example.com yourpassword --dir=/var/lib/oraclenet"
echo ""
echo "2. Check status:"
echo "   systemctl status oraclenet"
echo ""
echo "3. View logs:"
echo "   journalctl -u oraclenet -f"
