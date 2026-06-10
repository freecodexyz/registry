variable "name" {
  description = "Name prefix for AWS resources."
  type        = string
  default     = "registry"
}

variable "aws_region" {
  description = "AWS region. Leave null to use your AWS CLI/default provider configuration."
  type        = string
  default     = null
}

variable "aws_profile" {
  description = "AWS profile. Leave null to use your default AWS CLI credentials."
  type        = string
  default     = null
}

variable "instance_type" {
  description = "EC2 instance type for the Docker Compose host."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size" {
  description = "Root volume size in GiB."
  type        = number
  default     = 30
}

variable "ssh_cidr" {
  description = "CIDR allowed to SSH into the instance."
  type        = string
  default     = "0.0.0.0/0"
}

variable "web_cidr" {
  description = "CIDR allowed to access the web app."
  type        = string
  default     = "0.0.0.0/0"
}

variable "web_port" {
  description = "Public host port for the web app."
  type        = number
  default     = 80

  validation {
    condition     = var.web_port > 0 && var.web_port < 65536
    error_message = "web_port must be between 1 and 65535."
  }
}

variable "app_env" {
  description = "Environment variables written to the remote .env for docker compose. SIWE_DOMAIN and ALLOWED_ORIGINS default to the instance URL if omitted."
  type        = map(string)
  default     = {}
  sensitive   = true
}
