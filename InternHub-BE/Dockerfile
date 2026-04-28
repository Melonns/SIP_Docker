# Use PHP 8.4 FPM as the base image for Laravel
FROM php:8.4-fpm

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

# Copy OPcache config
COPY opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Copy PHP-FPM config
COPY php-fpm.conf /usr/local/etc/php-fpm.conf

# Copy upload limits config
COPY upload.ini /usr/local/etc/php/conf.d/upload.ini

# Set proper permissions for Laravel storage and bootstrap cache directories
RUN chown -R www-data:www-data /var/www/html && \
    chmod -R 775 /var/www/html/storage && \
    chmod -R 775 /var/www/html/bootstrap/cache
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.9.0/wait /wait
RUN chmod +x /wait

# Expose FPM port (Nginx will connect via TCP)
EXPOSE 9000

# Install dependencies and start PHP-FPM
CMD sh -c "\
  set -e && \
  chown -R www-data:www-data /var/www/html && \
  chmod -R 775 /var/www/html/storage && \
  chmod -R 775 /var/www/html/bootstrap/cache && \
  if [ ! -f .env ]; then cp .env.example .env; fi && \
  composer install --no-interaction && \
  php artisan key:generate && \
  echo 'Waiting for MySQL database...' && \
  for i in {1..30}; do \
    php artisan tinker --execute='DB::connection()->getPdo()' 2>/dev/null && echo 'Database ready!' && break; \
    echo \"Attempt \$i/30 - Waiting for DB...\"; \
    sleep 2; \
  done && \
  php artisan migrate --force && \
  php artisan db:seed --class=AdminUserSeeder --force && \
  php artisan config:cache && \
  php artisan route:cache && \
  php artisan view:cache && \
  php-fpm"
