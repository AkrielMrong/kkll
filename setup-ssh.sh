#!/bin/bash

# Install OpenSSH server
apt-get update
apt-get install -y openssh-server

# Create SSH directory and set permissions
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Generate SSH key pair
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# Configure SSH server
cat > /etc/ssh/sshd_config << EOF
Port 22
PermitRootLogin yes
PasswordAuthentication no
PubkeyAuthentication yes
AuthorizedKeysFile .ssh/authorized_keys
EOF

# Start SSH service
service ssh start

# Display public key
echo "Your public SSH key (add this to your authorized systems):"
cat ~/.ssh/id_rsa.pub

# Display connection information
echo -e "\nConnection details:"
echo "Host: $(hostname -I | awk '{print $1}')"
echo "Port: 22"
echo "Username: root"
