FROM python:3.11-slim

WORKDIR /app

# Copy application files
COPY . .

# Expose port
EXPOSE 3000

# Run the proxy server
CMD ["python", "-u", "server.py"]
