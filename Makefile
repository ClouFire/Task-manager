PORT ?= 3000

.PHONY: project-create test-all test-e2e-migrations


migration-generate:
	npm run typeorm -- migration:generate ./src/migrations/CreateProjects -d ./src/data-source.ts

migration-run:
	npm run typeorm -- migration:run -d ./src/data-source.ts

migration-status:
	npm run typeorm -- migration:show -d ./src/data-source.ts

migration-revert:
	npm run typeorm -- migration:revert -d ./src/data-source.ts

project-create:
	curl -i -X POST http://localhost:$(PORT)/projects \
		-H 'Content-Type: application/json' \
		-d '{"name":"Тестовый проект","description":"Проверка сохранения проекта"}'

project-get:
	curl -i -X GET http://localhost:$(PORT)/projects/bcebe26b-b14f-403a-aee6-d522a6cc3bd4

test-all:
	npm test -- --runInBand && npm run test:e2e:local

# Creates an isolated empty database, applies migrations, then tests the API.
test-e2e-migrations:
	npm run test:e2e:local
