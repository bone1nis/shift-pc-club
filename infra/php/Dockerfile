FROM php:8.5-cli-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends git unzip libpq-dev libonig-dev libxml2-dev libzip-dev \
    && docker-php-ext-install pdo_pgsql mbstring bcmath sockets pcntl zip \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
WORKDIR /app
ENV COMPOSER_ALLOW_SUPERUSER=1
CMD ["php", "artisan", "serve", "--no-reload", "--host=0.0.0.0", "--port=8000"]
