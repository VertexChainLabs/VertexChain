resource "aws_sns_topic" "vertexchain_alerts" {
  name = "vertexchain-alerts"
}

resource "aws_sns_topic_subscription" "vertexchain_email" {
  topic_arn = aws_sns_topic.vertexchain_alerts.arn
  protocol  = "email"
  endpoint  = "ops@vertexchain.io"
}
