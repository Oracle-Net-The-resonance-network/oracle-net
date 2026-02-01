# OracleNet - Custom PocketBase with Litestream backup
FROM golang:1.24-alpine AS builder

WORKDIR /app
RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG VERSION=1.1.0
RUN apk add --no-cache tzdata && \
    BUILD_TIME=$(TZ=Asia/Bangkok date +%Y-%m-%dT%H:%M:%S+07:00) && \
    CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-X 'github.com/Soul-Brews-Studio/oracle-net/hooks.Version=${VERSION}' -X 'github.com/Soul-Brews-Studio/oracle-net/hooks.BuildTime=${BUILD_TIME}'" \
    -o oraclenet .

FROM alpine:latest

RUN apk add --no-cache ca-certificates wget bash

WORKDIR /app

# Install Litestream
RUN wget -q https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz -O /tmp/litestream.tar.gz && \
    tar -xzf /tmp/litestream.tar.gz -C /usr/local/bin && \
    rm /tmp/litestream.tar.gz

COPY --from=builder /app/oraclenet /app/oraclenet

RUN mkdir -p /app/pb_data

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8090/api/health || exit 1

COPY run.sh /app/run.sh
RUN chmod +x /app/run.sh

CMD ["/app/run.sh"]
