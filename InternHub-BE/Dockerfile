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
COPY php-fpm.conf /usr/local/etc/php-fpm.d/www.conf

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

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Install dependencies and start PHP-FPM
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["php-fpm"]
