terraform {
  required_version = ">= 1.5.0"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"]

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd*/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

data "archive_file" "source" {
  type        = "zip"
  source_dir  = "${path.module}/.."
  output_path = "${path.module}/.terraform/registry-source.zip"

  excludes = [
    ".DS_Store",
    ".env",
    ".git",
    "apps/api/data",
    "apps/api/dist",
    "apps/api/node_modules",
    "apps/web/dist",
    "apps/web/node_modules",
    "dist",
    "node_modules",
    "terraform",
  ]
}

resource "tls_private_key" "ssh" {
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_sensitive_file" "ssh_private_key" {
  content         = tls_private_key.ssh.private_key_pem
  filename        = "${path.module}/${var.name}.pem"
  file_permission = "0600"
}

resource "aws_key_pair" "app" {
  key_name_prefix = "${var.name}-"
  public_key      = tls_private_key.ssh.public_key_openssh
}

resource "aws_security_group" "app" {
  name_prefix = "${var.name}-"
  description = "${var.name} Docker Compose host"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.ssh_cidr]
  }

  ingress {
    description = "Web"
    from_port   = var.web_port
    to_port     = var.web_port
    protocol    = "tcp"
    cidr_blocks = [var.web_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = var.name
  }
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.ubuntu.id
  instance_type               = var.instance_type
  associate_public_ip_address = true
  key_name                    = aws_key_pair.app.key_name
  vpc_security_group_ids      = [aws_security_group.app.id]

  root_block_device {
    volume_size = var.root_volume_size
    volume_type = "gp3"
  }

  user_data = <<-EOF
#!/bin/bash
set -eux
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io docker-compose-v2 unzip
systemctl enable --now docker
usermod -aG docker ubuntu
mkdir -p /opt/registry
chown -R ubuntu:ubuntu /opt/registry
EOF

  tags = {
    Name = var.name
  }
}

locals {
  web_host   = var.web_port == 80 ? aws_instance.app.public_ip : "${aws_instance.app.public_ip}:${var.web_port}"
  web_origin = "http://${local.web_host}"

  default_app_env = {
    ALLOWED_ORIGINS               = jsonencode([local.web_origin])
    CONTRACT_ADDRESS              = ""
    CHAIN_ID                      = "8453"
    EVENTS_SOCKET_PORT            = "3055"
    GATE_TOKEN_ADDRESS            = "0x67A7CA081Dc79B45fD1FA059Cd3b8dCcA779Aba3"
    GATE_TOKEN_MIN_BALANCE        = ""
    GITHUB_TOKEN                  = ""
    LAUNCHER_ADDRESS              = ""
    RPC_URL                       = "https://mainnet.base.org"
    SESSION_KEY                   = ""
    SESSION_COOKIE_SECURE         = "false"
    SIWE_DOMAIN                   = local.web_host
    STATE_VIEW                    = "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71"
    SWAP_ASSETS_FILE_PATH         = ""
    UNISWAP_API_KEY               = ""
    UNISWAP_API_URL               = "https://trade-api.gateway.uniswap.org/v1"
    V4_POOL_MANAGER               = ""
    VITE_WALLETCONNECT_PROJECT_ID = ""
  }

  remote_env = merge(local.default_app_env, var.app_env, {
    API_PUBLISHED_PORT = "127.0.0.1:3000"
    WEB_PUBLISHED_PORT = tostring(var.web_port)
  })

  env_file = "${join("\n", [for key in sort(keys(local.remote_env)) : "${key}='${replace(tostring(local.remote_env[key]), "'", "\\'")}'"])}\n"
}

resource "terraform_data" "bootstrap" {
  depends_on = [aws_instance.app]

  connection {
    type        = "ssh"
    user        = "ubuntu"
    host        = aws_instance.app.public_ip
    private_key = tls_private_key.ssh.private_key_pem
    timeout     = "5m"
  }

  provisioner "remote-exec" {
    inline = [
      "cloud-init status --wait",
      "sudo mkdir -p /opt/registry",
      "sudo chown -R ubuntu:ubuntu /opt/registry",
    ]
  }
}

resource "terraform_data" "deploy" {
  depends_on = [terraform_data.bootstrap]

  triggers_replace = {
    env_sha     = nonsensitive(sha256(local.env_file))
    instance_id = aws_instance.app.id
    source_sha  = data.archive_file.source.output_base64sha256
  }

  connection {
    type        = "ssh"
    user        = "ubuntu"
    host        = aws_instance.app.public_ip
    private_key = tls_private_key.ssh.private_key_pem
    timeout     = "5m"
  }

  provisioner "file" {
    source      = data.archive_file.source.output_path
    destination = "/tmp/registry-source.zip"
  }

  provisioner "file" {
    content     = local.env_file
    destination = "/tmp/registry.env"
  }

  provisioner "remote-exec" {
    inline = [
      "sudo mkdir -p /opt/registry",
      "sudo unzip -q -o /tmp/registry-source.zip -d /opt/registry",
      "sudo mv /tmp/registry.env /opt/registry/.env",
      "sudo chmod 600 /opt/registry/.env",
      "sudo chown -R ubuntu:ubuntu /opt/registry",
      "cd /opt/registry && sudo docker compose --env-file .env up -d --build --remove-orphans",
      "sudo docker image prune -f",
    ]
  }
}
