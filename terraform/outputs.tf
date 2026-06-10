output "app_url" {
  value = "http://${local.web_host}"
}

output "public_ip" {
  value = aws_instance.app.public_ip
}

output "ssh_command" {
  value = "ssh -i ${local_sensitive_file.ssh_private_key.filename} ubuntu@${aws_instance.app.public_ip}"
}
