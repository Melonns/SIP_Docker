# Use PHP 8.2 CLI as the base image for Laravel Development
FROM php:8.2-cli

# Set working directory
WORKDIR /var/www/html

# Install system dependencies & PHP extensions
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    libzip-dev \
    && docker-php-ext-install pdo_mysql mbstring exif pcntl bcmath gd zip

# Install Composer globally
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

# Copy the existing Laravel code into the container
COPY . /var/www/html

# Wait script to wait for DB
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.9.0/wait /wait
RUN chmod +x /wait

# Expose port 8000 for Artisan serve
EXPOSE 8000

# Install dependencies and start the Laravel dev server
CMD sh -c "if [ ! -f .env ]; then cp .env.example .env; fi && composer install --no-interaction && php artisan key:generate && php artisan migrate --force && php artisan serve --host=0.0.0.0 --port=8000"
