#!/bin/bash

set -e

echo "========================================="
echo "Pegasus Bot - Test Suite Runner"
echo "========================================="

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

cleanup() {
    echo ""
    echo "Cleaning up test environment..."
    docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
    rm -f .env.test
}

trap cleanup EXIT

echo ""
echo "Setting up test environment..."

cat > .env.test << EOF
NODE_ENV=test
DISCORD_TOKEN=test_token
DATABASE_URL=postgresql://test:test@localhost:5433/pegasus_test
REDIS_URL=redis://localhost:6380
BOT_API_TOKEN=test_api_token
DEVELOPER_IDS=["123456789012345678"]
DEFAULT_LANGUAGE=en
LOG_LEVEL=error
EOF

print_status "Test environment configured"

echo ""
echo "Starting test infrastructure..."
docker-compose -f docker-compose.test.yml up -d postgres-test redis-test

echo "Waiting for services to be ready..."
sleep 5

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose -f docker-compose.test.yml exec -T postgres-test pg_isready -U test >/dev/null 2>&1; then
        print_status "PostgreSQL is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "PostgreSQL failed to start"
    exit 1
fi

RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker-compose -f docker-compose.test.yml exec -T redis-test redis-cli ping >/dev/null 2>&1; then
        print_status "Redis is ready"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    print_error "Redis failed to start"
    exit 1
fi

echo ""
echo "Installing dependencies..."
npm ci --silent
print_status "Dependencies installed"

echo ""
echo "Running type checking..."
if npm run typecheck; then
    print_status "Type checking passed"
else
    print_error "Type checking failed"
    exit 1
fi

echo ""
echo "Running linter..."
if npm run lint 2>/dev/null; then
    print_status "Linting passed"
else
    print_warning "Linting has warnings"
fi

echo ""
echo "Running database migrations..."
DATABASE_URL=postgresql://test:test@localhost:5433/pegasus_test npm run db:migrate
print_status "Database migrations completed"

echo ""
echo "Running unit tests..."
if npm test -- --testPathPattern="unit|commands|services" --coverage; then
    print_status "Unit tests passed"
else
    print_error "Unit tests failed"
    exit 1
fi

echo ""
echo "Running integration tests..."
if npm test -- --testPathPattern="api|integration" --coverage; then
    print_status "Integration tests passed"
else
    print_error "Integration tests failed"
    exit 1
fi

echo ""
echo "Running end-to-end tests with Docker..."
if docker-compose -f docker-compose.test.yml run --rm test-runner; then
    print_status "E2E tests passed"
else
    print_error "E2E tests failed"
    exit 1
fi

echo ""
echo "Generating coverage report..."
npm test -- --coverage --coverageReporters=text-summary

echo ""
echo "========================================="
echo -e "${GREEN}All tests passed successfully!${NC}"
echo "========================================="

COVERAGE_LINES=$(grep "Lines" coverage/coverage-summary.json | grep -oE "[0-9]+\.[0-9]+" | head -1)
COVERAGE_BRANCHES=$(grep "Branches" coverage/coverage-summary.json | grep -oE "[0-9]+\.[0-9]+" | head -1)
COVERAGE_FUNCTIONS=$(grep "Functions" coverage/coverage-summary.json | grep -oE "[0-9]+\.[0-9]+" | head -1)
COVERAGE_STATEMENTS=$(grep "Statements" coverage/coverage-summary.json | grep -oE "[0-9]+\.[0-9]+" | head -1)

echo ""
echo "Coverage Summary:"
echo "  Lines:      ${COVERAGE_LINES}%"
echo "  Branches:   ${COVERAGE_BRANCHES}%"
echo "  Functions:  ${COVERAGE_FUNCTIONS}%"
echo "  Statements: ${COVERAGE_STATEMENTS}%"

if (( $(echo "$COVERAGE_LINES < 80" | bc -l) )); then
    print_warning "Coverage is below 80% threshold"
fi

echo ""
echo "Test report available at: coverage/lcov-report/index.html"