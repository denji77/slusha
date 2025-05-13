# filepath: c:\Users\xdenj\OneDrive\Desktop\VS Code\slusha\Dockerfile
# Use the official Deno image
FROM denoland/deno:alpine-1.35.0

# Set the working directory
WORKDIR /app

# Copy necessary files, excluding those in .dockerignore
COPY . .

# Install dependencies without using the lock file
RUN deno cache main.ts

# Expose the port (if applicable)
EXPOSE 8080

# Set environment variables
ENV DENO_ENV=production

# Run the application
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]