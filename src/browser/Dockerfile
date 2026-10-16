FROM python:3.12-slim

# Install system dependencies, Chromium, and Xvfb for headless Linux operation
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    curl \
    gnupg \
    xvfb \
    ca-certificates \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements
COPY requirements.txt /app/requirements.txt

# Install python dependencies and playwright browser
RUN pip install --no-cache-dir -r requirements.txt && \
    playwright install chromium --with-deps

# Copy browser service code
COPY server.py /app/server.py

EXPOSE 8765

ENV PYTHONUNBUFFERED=1
ENV BROWSER_PORT=8765
ENV BROWSER_HOST=0.0.0.0
ENV DISPLAY=:99

# Start virtual framebuffer then start server
CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x800x24 & python /app/server.py"]
