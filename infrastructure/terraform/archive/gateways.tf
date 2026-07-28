resource "aws_internet_gateway" "vertexchain" {
  vpc_id = aws_vpc.vertexchain.id
  tags   = { Name = "vertexchain-igw" }
}

resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "vertexchain" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public_a.id
  tags          = { Name = "vertexchain-nat" }
  depends_on    = [aws_internet_gateway.vertexchain]
}
