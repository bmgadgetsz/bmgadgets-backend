# 🚀 Oracle Cloud "Always Free" Deployment & Auto-Deploy Guide

This guide walks you through setting up your **Oracle Cloud Always Free VM** and configuring **automatic redeployment on `git push` to `main`**.

---

## Part 1: Create Your Oracle Cloud Always Free VM

1. Log into your [Oracle Cloud Console](https://cloud.oracle.com/).
2. Navigate to **Compute** -> **Instances** -> **Create Instance**.
3. Configure the VM:
   - **Name**: `bmq-backend-server`
   - **Image**: **Ubuntu 22.04 LTS** or **Ubuntu 24.04 LTS**
   - **Shape**:
     - *Option A (Recommended)*: **Ampere ARM** (Up to 4 OCPUs, 24 GB RAM — Always Free eligible)
     - *Option B*: **VM.Standard.E2.1.Micro** (1 OCPU, 1 GB RAM — Always Free)
   - **SSH Keys**: Download and save the generated private key (e.g., `ssh-key-oracle.key`) to your computer.
4. Click **Create** and wait for the instance state to show **Running**. Note your **Public IP Address**.

---

## Part 2: Open Ingress Ports in Oracle Cloud

Oracle Cloud instances block all incoming traffic by default.

1. In the instance details, click on your **Virtual Cloud Network (VCN)** -> **Security Lists** -> **Default Security List**.
2. Click **Add Ingress Rules**:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port Range**: `80, 443, 5000`
   - **Description**: `HTTP, HTTPS, and Backend Port`
3. Click **Add Ingress Rules**.

---

## Part 3: Configure the VM & Install Docker

1. Connect to your VM via terminal from your local machine:
   ```bash
   chmod 400 /path/to/ssh-key-oracle.key
   ssh -i /path/to/ssh-key-oracle.key ubuntu@<YOUR_ORACLE_PUBLIC_IP>
   ```

2. Open the Ubuntu firewall (Oracle's default `iptables` also blocks external ports):
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 5000 -j ACCEPT
   sudo netfilter-persistent save || sudo apt-get install -y iptables-persistent && sudo netfilter-persistent save
   ```

3. Install Docker & Docker Compose:
   ```bash
   sudo apt-get update -y
   sudo apt-get install -y ca-certificates curl gnupg git
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Allow ubuntu user to run docker without sudo
   sudo usermod -aG docker ubuntu
   newgrp docker
   ```

---

## Part 4: Clone the Repo & Start the App

1. On the VM, clone your repository into `/home/ubuntu/bmq-backend`:
   ```bash
   cd /home/ubuntu
   git clone https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git bmq-backend
   cd bmq-backend
   ```

2. Create your `.env` file on the server:
   ```bash
   nano .env
   ```
   Paste all your environment variables (`DATABASE_URL`, `REDIS_URL`, `AWS_*`, `RAZORPAY_*`, etc.) and save with `Ctrl+O`, `Enter`, `Ctrl+X`.
   
   *(Note: If you use the bundled local Redis container from `docker-compose.yml`, set `REDIS_URL=redis://redis:6379`)*

3. Build and start the containers for the first time:
   ```bash
   docker compose up -d --build
   ```

4. Verify status and logs:
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```
   Test in browser or curl: `http://<YOUR_ORACLE_PUBLIC_IP>:5000/health`

---

## Part 5: Setup Automatic Redeploy on `git push`

To enable GitHub Actions to SSH into your Oracle server and deploy automatically on push:

1. Open your repository on **GitHub** -> **Settings** -> **Secrets and variables** -> **Actions** -> **New repository secret**.
2. Add the following 3 secrets:

| Secret Name | Value |
| :--- | :--- |
| `ORACLE_HOST` | Your Oracle VM's Public IP (e.g. `129.146.x.x`) |
| `ORACLE_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | The **entire contents** of your private SSH key file (`ssh-key-oracle.key`), including `-----BEGIN RSA PRIVATE KEY-----` and `-----END RSA PRIVATE KEY-----` |

3. **That's it!** Whenever you push code to `main`:
   - GitHub Actions will trigger [.github/workflows/deploy.yml](file:///.github/workflows/deploy.yml)
   - It will pull changes, rebuild the Docker containers, and restart your backend without downtime.
