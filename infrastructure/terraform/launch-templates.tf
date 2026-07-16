resource "aws_launch_template" "app" {
  name_prefix   = "${var.project_name}-${var.environment}-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  vpc_security_group_ids = [aws_security_group.app.id]

  iam_instance_profile {
    name = aws_iam_instance_profile.app.name
  }

  monitoring {
    enabled = true
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Environment = var.environment
      Project     = var.project_name
    }
  }
}

resource "aws_iam_instance_profile" "app" {
  name = "${var.project_name}-${var.environment}-instance-profile"
  role = "${var.project_name}-${var.environment}-ec2-role"
}
