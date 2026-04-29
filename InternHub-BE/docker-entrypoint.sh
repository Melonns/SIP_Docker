#!/bin/bash
set -e

echo "================================"
echo "🚀 Starting Laravel Container..."
echo "================================"

# Permissions set manually if needed

# Copy .env if not exists
if [ ! -f .env ]; then
    echo "📋 Copying .env.example to .env..."
    cp .env.example .env
fi

# Install composer dependencies if vendor folder is missing
if [ ! -d "vendor" ]; then
    echo "📦 Vendor folder not found. Installing composer dependencies..."
    composer install --no-interaction --optimize-autoloader
else
    echo "📦 Vendor folder exists, skipping composer install."
fi

# Generate app key if not present
if [ -f .env ] && ! grep -q "APP_KEY=base64" .env; then
    echo "🔑 Generating application key..."
    php artisan key:generate || true
else
    echo "🔑 Application key already exists, skipping."
fi

# Wait for MySQL database
echo "⏳ Waiting for MySQL database..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if php artisan tinker --execute='DB::connection()->getPdo()' 2>/dev/null; then
        echo "✅ Database is ready!"
        break
    fi
    
    echo "   Attempt $attempt/$max_attempts - Waiting for DB..."
    sleep 2
    ((attempt++))
done

if [ $attempt -gt $max_attempts ]; then
    echo "❌ Database connection failed after $max_attempts attempts"
    exit 1
fi

# Run migrations
echo "🔄 Running database migrations..."
php artisan migrate --force || true

# Create storage link for public access
echo "🔗 Creating storage link..."
if [ ! -L public/storage ]; then
    php artisan storage:link || true
fi

# Run seeders (only if explicitly requested via RUN_SEEDERS=true and not run yet)
if [ "$RUN_SEEDERS" = "true" ]; then
    if [ ! -f .seeders_run ]; then
        echo "Running seeders list..."
        php artisan db:seed --class=RoleSeeder --force || true
        php artisan db:seed --class=PermissionSeeder --force || true
        php artisan db:seed --class=RolePermissionSeeder --force || true
        php artisan db:seed --class=WorkScheduleSeeder --force || true
        php artisan db:seed --class=AdminUserSeeder --force || true
        php artisan db:seed --class=DivisionSeeder --force || true
        php artisan db:seed --class=KaryawanSeeder --force || true
        php artisan db:seed --class=LiburSeeder --force || true
        php artisan db:seed --class=KomponenSeeder --force || true
        php artisan db:seed --class=TagSeeder --force || true
        touch .seeders_run
    else
        echo "Skipping seeders (already run once via .seeders_run file)..."
    fi
else
    echo "Skipping seeders (RUN_SEEDERS is not true)..."
fi

# Caching configuration for fast disk I/O on WSL
echo "⚙️  Caching configuration..."
php artisan config:cache || true

echo "🛣️  Caching routes..."
php artisan route:cache || true

echo "🎨 Caching views..."
php artisan view:cache || true

echo "================================"
echo "✨ Container ready!"
echo "================================"

# Start PHP-FPM
exec "$@"
