# Use Node 20 as the base image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (use npm ci for reliable builds if package-lock is solid, else npm install)
RUN npm install

# Copy the rest of the application
COPY . .

# Expose Vite's default dev port
EXPOSE 5173

# Start Vite dev server on all networks, generate .env from docker-compose env vars
CMD sh -c "\
  if [ ! -f .env ]; then cp .env.example .env; fi && \
  echo 'VITE_API_BASE_URL='${VITE_API_BASE_URL:-/api} > .env.docker && \
  echo 'VITE_PROXY_TARGET='${VITE_PROXY_TARGET:-http://localhost:8000} >> .env.docker && \
  echo 'VITE_PUSHER_APP_KEY='${VITE_PUSHER_APP_KEY} >> .env.docker && \
  echo 'VITE_PUSHER_APP_CLUSTER='${VITE_PUSHER_APP_CLUSTER} >> .env.docker && \
  cat .env.docker >> .env && \
  npm run dev -- --host"
