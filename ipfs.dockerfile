# Use a multi-stage build to keep the final image small
FROM golang:1.24-alpine AS builder

# Install necessary build dependencies
RUN apk add --no-cache git make gcc musl-dev bash

# Clone and build Kubo
RUN git clone https://github.com/ipfs/kubo.git /kubo && \
    cd /kubo && \
    make build && \
    ./cmd/ipfs/ipfs --version

# Start with a clean Alpine image
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tini bash

# Create a non-root user
RUN adduser -D -h /home/ipfs -u 1000 ipfs

# Copy the IPFS binary from the builder stage
COPY --from=builder /kubo/cmd/ipfs/ipfs /usr/local/bin/ipfs

# Create IPFS directories and set permissions
RUN mkdir -p /data/ipfs && \
    chown -R ipfs:ipfs /data/ipfs && \
    chmod 700 /data/ipfs

# Set environment variables
ENV IPFS_PATH=/data/ipfs

# Switch to non-root user
USER ipfs

# Initialize IPFS with default configuration
RUN ipfs init --profile=server && \
    # Configure IPFS for server usage
    ipfs config Addresses.API "/ip4/0.0.0.0/tcp/5001" && \
    ipfs config Addresses.Gateway "/ip4/0.0.0.0/tcp/8080" && \
    # Set storage limits to 10GB
    ipfs config --json Datastore.StorageMax "\"10GB\"" && \
    # Set GC watermark to 90% of storage max
    ipfs config --json Datastore.GCPeriod "\"1h\"" && \
    ipfs config --json Datastore.StorageGCWatermark 90 && \
    # Enable basic features
    ipfs config --json Swarm.RelayClient.Enabled true && \
    ipfs config --json Swarm.RelayService.Enabled true

# Expose IPFS ports
# 4001: Swarm
# 5001: API
# 8080: Gateway
EXPOSE 4001/tcp 5001/tcp 8080/tcp

# Use tini as init system
ENTRYPOINT ["/sbin/tini", "--"]

# Start IPFS daemon
CMD ["ipfs", "daemon", "--migrate=true", "--agent-version-suffix=docker"]
