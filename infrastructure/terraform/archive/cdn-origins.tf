variable "api_domain" {
  description = "API domain for CloudFront origin"
  type        = string
  default     = "api.vertexchain.io"
}

locals {
  api_origin_id      = "API-backend"
  frontend_origin_id = "S3-frontend"
}
