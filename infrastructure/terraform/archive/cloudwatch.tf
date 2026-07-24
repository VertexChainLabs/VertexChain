resource "aws_cloudwatch_log_group" "vertexchain" {
  name              = "/vertexchain/app"
  retention_in_days = 30
}

resource "aws_cloudwatch_dashboard" "vertexchain" {
  dashboard_name = "vertexchain-dashboard"
  dashboard_body = jsonencode({
    widgets = [
      {
        type = "metric"
        properties = {
          title   = "CPU Utilization"
          metrics = [["AWS/ECS", "CPUUtilization", "ServiceName", "vertexchain"]]
          period  = 300
          stat    = "Average"
        }
      }
    ]
  })
}
