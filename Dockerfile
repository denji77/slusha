# Use the official Deno image
FROM denoland/deno:alpine-1.35.0

# Set the working directory
WORKDIR /app

# Copy necessary files
COPY . .

# Install dependencies
RUN deno cache main.ts

# Expose the port (if applicable)
EXPOSE 8080

# Set environment variables
ENV DENO_ENV=production

# Run the application
CMD ["run", "--allow-net", "--allow-env", "--allow-read", "main.ts"]