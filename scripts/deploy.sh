#\!/bin/bash

# Pegasus Bot Production Deployment Script
# This script handles deployment to various platforms

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}✓ $1${NC}"
}

warn() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

# Default values
PLATFORM=""
ENVIRONMENT="production"
SKIP_TESTS=false
VERBOSE=false

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)
            PLATFORM="$2"
            shift 2
            ;;
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --platform PLATFORM    Deployment platform (railway, heroku, vps, docker)"
            echo "  --env ENVIRONMENT      Environment (production, staging, development)"
            echo "  --skip-tests           Skip running tests before deployment"
            echo "  --verbose              Enable verbose output"
            echo "  --help                 Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --platform railway --env production"
            echo "  $0 --platform docker --verbose"
            exit 0
            ;;
        *)
            error "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate platform
if [[ -z "$PLATFORM" ]]; then
    error "Platform is required. Use --platform to specify deployment platform."
    echo "Supported platforms: railway, heroku, vps, docker"
    exit 1
fi

log "Starting deployment to $PLATFORM (environment: $ENVIRONMENT)"

# Pre-deployment checks
log "Running pre-deployment checks..."
node scripts/startup.js --check-only ${VERBOSE:+--verbose}

if [[ "$SKIP_TESTS" == false ]]; then
    log "Running tests..."
    if command -v npm run test &> /dev/null; then
        npm run test
        success "Tests passed"
    else
        warn "No test script found, skipping tests"
    fi
fi

# Platform-specific deployment
case $PLATFORM in
    railway)
        log "Deploying to Railway..."
        
        # Check if Railway CLI is installed
        if \! command -v railway &> /dev/null; then
            error "Railway CLI is not installed. Install it from https://railway.app/cli"
            exit 1
        fi
        
        # Deploy to Railway
        railway up
        success "Deployed to Railway successfully"
        ;;
        
    heroku)
        log "Deploying to Heroku..."
        
        # Check if Heroku CLI is installed
        if \! command -v heroku &> /dev/null; then
            error "Heroku CLI is not installed. Install it from https://devcenter.heroku.com/articles/heroku-cli"
            exit 1
        fi
        
        # Deploy to Heroku
        git push heroku main
        success "Deployed to Heroku successfully"
        ;;
        
    vps)
        log "Deploying to VPS..."
        
        # This would typically involve SSH and rsync commands
        # Customize this section based on your VPS setup
        warn "VPS deployment requires manual configuration"
        warn "Please configure SSH and deployment scripts for your VPS"
        ;;
        
    docker)
        log "Building Docker image..."
        
        # Build production Docker image
        docker build -t pegasus-bot:latest .
        success "Docker image built successfully"
        
        # Optional: Push to registry
        if [[ -n "$DOCKER_REGISTRY" ]]; then
            log "Pushing to Docker registry..."
            docker tag pegasus-bot:latest $DOCKER_REGISTRY/pegasus-bot:latest
            docker push $DOCKER_REGISTRY/pegasus-bot:latest
            success "Docker image pushed to registry"
        fi
        ;;
        
    *)
        error "Unsupported platform: $PLATFORM"
        exit 1
        ;;
esac

success "Deployment completed successfully\!"
DEPLOY_EOF < /dev/null
