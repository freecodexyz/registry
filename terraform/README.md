# Terraform AWS Deploy

Minimal EC2 deployment for the existing `docker-compose.yml`.

## Usage

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Fill app_env in terraform.tfvars
terraform init
terraform apply
```

Terraform creates one Ubuntu EC2 instance, installs Docker Compose, uploads the current repo without local build artifacts/secrets, writes `/opt/registry/.env`, and runs:

```sh
docker compose --env-file .env up -d --build --remove-orphans
```

The web app is exposed on `app_url`. The API is bound to `127.0.0.1:3000` on the instance and is reached by the web container through the existing nginx `/api` proxy.

Because this minimal setup serves HTTP directly from the EC2 public IP, `SESSION_COOKIE_SECURE` defaults to `false`. Set it to `true` only after putting the app behind HTTPS.

To remove everything:

```sh
terraform destroy
```

`app_env` values are sensitive, but Terraform still stores them in local state. Keep `terraform.tfstate` private.
