# Task Manager API

API для создания и получения проектов на NestJS и PostgreSQL. Ниже описан
полный локальный запуск: создание базы, применение миграций и проверка API.

## Требования

- Node.js 24 и npm.
- Docker с Docker Compose.
- GNU Make для команд из [Makefile](./Makefile).

Все команды выполняются из корня репозитория.

## Запуск с пустой базой

### 1. Установить зависимости и подготовить окружение

```bash
npm ci
```

Если файла `.env` ещё нет, создай его из примера:

```bash
cp .env.example .env
```

Существующий `.env` перезаписывать не нужно. Для этого сценария укажи в нём:

```dotenv
DATABASE_URL=postgresql://nest:nest@127.0.0.1:5432/nest
```

Пример [.env.example](./.env.example) по умолчанию указывает на staging;
здесь используется отдельная локальная база `nest`.

### 2. Запустить PostgreSQL

```bash
docker compose up -d --wait postgres
```

При первом запуске с новым томом контейнер создаст пустую базу `nest`
с пользователем и паролем `nest`. Если том уже существует, сохранятся его
данные: эта команда не очищает базу.

### 3. Применить миграции

```bash
DATABASE_URL=postgresql://nest:nest@127.0.0.1:5432/nest make migration-run
DATABASE_URL=postgresql://nest:nest@127.0.0.1:5432/nest make migration-status
```

В статусе все миграции должны быть отмечены `[X]`. Явный `DATABASE_URL`
гарантирует, что команды используют ту же базу, что и API в следующем шаге.
Схема создаётся миграциями из [src/migrations](./src/migrations): автоматическая
синхронизация отключена. После получения новых миграций повтори `migration-run`
перед запуском API; уже применённые миграции повторно не выполняются.

### 4. Запустить API

```bash
PORT=3000 npm run start:production:local
```

Это локальный запуск в режиме watch с подключением к базе `nest`, а не
развёртывание в production. Дождись сообщения `Nest application successfully started`.
Оставь этот терминал открытым.

### 5. Создать и получить проект

В другом терминале:

```bash
make project-create PORT=3000
```

Ожидается HTTP `201` и JSON с `id`, `name`, `description` и `createdAt`.
Подставь полученный `id` в запрос:

```bash
curl -i http://localhost:3000/projects/ВСТАВЬ_UUID_ИЗ_ОТВЕТА
```

Ожидается HTTP `200` с созданным проектом. Порт `3000` относится к HTTP API,
порт `5432` — к PostgreSQL. При ошибке подключения к `3000` проверь, что API
запущен и не завершился с ошибкой.

## Остановка и сохранность данных

API останавливается через `Ctrl+C`. Для остановки базы:

```bash
docker compose stop postgres
```

Данные сохраняются в именованном томе `postgres_data`, подключённом в
[docker-compose.yaml](./docker-compose.yaml). Перезапуск API и пересоздание
контейнера с тем же томом не очищают базу. `docker compose down` также
сохраняет тома; `docker compose down -v` удаляет их вместе с данными.

## Staging и инфраструктура

Подробности о двух окружениях, портах, томах и ежедневном копировании данных
описаны в [docker/README.md](./docker/README.md).

`npm run start:local` запускает API для staging на порту `3001`.
`npm run db:up` включает сервис `stage-refresh`, который заменяет данные
staging копией базы `nest`. Для обычной работы с постоянными локальными
данными используй последовательность запуска выше: она не включает обновление staging.

## Проверки и CI

Unit-тесты, сборка и lint:

```bash
npm test -- --runInBand
npm run build
npm run lint
```

Воспроизводимая проверка миграций с нуля и работы API:

```bash
docker compose up -d --wait postgres-stage
make test-e2e-migrations
```

Каждый e2e-тест создаёт отдельную пустую базу из `template0`, применяет все
миграции и проверяет API с `synchronize: false`. После теста временная база
удаляется, в том числе при ошибке. Базы `nest`, `nest_stage` и `nest_test`
не очищаются. Если миграция не применяется, тест падает до API-запросов.

Тестовому пользователю PostgreSQL нужны право `CREATEDB` и разрешение на
установку `uuid-ossp`. Локальные Docker-пользователи и пользователь CI
имеют необходимые права. Для другого тестового сервера:

```bash
TEST_DATABASE_URL=postgresql://user:password@localhost:5432/nest_test npm run test:e2e -- --runInBand
```

[GitHub Actions](./.github/workflows/ci.yml) запускает сборку, lint, unit-тесты
и тот же e2e-набор с миграциями на временном PostgreSQL.
