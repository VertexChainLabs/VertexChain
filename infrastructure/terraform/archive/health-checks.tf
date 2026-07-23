resource "aws_route53_health_check" "vertexchain_api" {
  fqdn              = "api.vertexchain.io"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/health"
  failure_threshold = 3
  request_interval  = 30
}
