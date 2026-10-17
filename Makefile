.PHONY: help setup dev test lint start

help:
	@echo "DATAPRISM Commands:"
	@echo "  make start   - Run the unified DATAPRISM application (API + Web on :8050)"
	@echo "  make test    - Run pytest backend test suite"
	@echo "  make build   - Build React production frontend"

start:
	python run.py

test:
	.\.venv\Scripts\pytest apps/api/tests

build:
	npm run build --prefix apps/web
