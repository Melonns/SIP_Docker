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

# Install composer dependencies
# Composer install removed for fast startup

# Generate app key
echo "🔑 Generating application key..."
php artisan key:generate || true

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
php artisan storage:link || true

# Run seeders (only if explicitly requested via RUN_SEEDERS=true)
if [ "$RUN_SEEDERS" = "true" ]; then
    echo "Running seeders..."
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
else
    echo "Skipping seeders (RUN_SEEDERS is not true)..."
fi

# Cache configuration
echo "⚙️  Caching configuration..."
php artisan config:cache || true

# Cache routes
echo "🛣️  Caching routes..."
php artisan route:cache || true

# Cache views (with timeout to prevent hanging)
echo "🎨 Caching Blade views..."
timeout 60 php artisan view:cache || {
    echo "⚠️  View cache failed or timed out, continuing without caching..."
    php artisan view:clear || true
}

echo "================================"
echo "✨ Container ready!"
echo "================================"

# Start PHP-FPM
exec "$@"
