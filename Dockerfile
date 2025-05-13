# filepath: c:\Users\xdenj\OneDrive\Desktop\VS Code\slusha\Dockerfile
# Use an updated official Deno image (Deno 1.41.3)
FROM denoland/deno:alpine-1.41.3

# Set the working directory
WORKDIR /app

# Install curl and ca-certificates using Alpine's package manager
RUN apk update && apk add --no-cache curl ca-certificates

# Copy necessary files, excluding those in .dockerignore
COPY . .

# Diagnostic curl command to test network connectivity to JSR
# This will still fail if the 404 persists, but ca-certificates might help
RUN echo "Attempting to curl a JSR module (diagnostic)..." && \
    curl -fvS https://jsr.io/@deno-library/logger@1.1.9/mod.ts && \
    echo "Curl successful." || echo "Curl command failed, but continuing to deno cache..."

# Install dependencies without using the lock file
# With Deno 1.41.3, ensure your .ts files use jsr: specifiers.
# Example: import { Logger } from 'jsr:@deno-library/logger@1.1.9';
RUN deno cache main.ts

# Expose the port (if applicable)
EXPOSE 8080

# Set environment variables
ENV DENO_ENV=production

# Run the application
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "--allow-write=./tmp", "main.ts"]