# Contributing to Pegasus Discord Bot

We love your input! We want to make contributing to Pegasus Discord Bot as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `develop`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code follows the existing style.
6. Issue that pull request!

## Setting Up Development Environment

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/pegasus-bot.git
   cd pegasus-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Using Docker
   docker run -d \
     --name pegasus-postgres \
     -e POSTGRES_USER=pegasus \
     -e POSTGRES_PASSWORD=your_password \
     -e POSTGRES_DB=pegasus \
     -p 5432:5432 \
     postgres:15
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

## Code Style Guide

### TypeScript

- Use TypeScript for all new code
- Enable strict mode in tsconfig.json
- Use explicit types instead of `any` when possible
- Prefer interfaces over type aliases for object shapes

### Naming Conventions

- **Files**: Use camelCase for file names (e.g., `giveawayHandler.ts`)
- **Classes**: Use PascalCase (e.g., `GiveawayHandler`)
- **Functions/Variables**: Use camelCase (e.g., `createGiveaway`)
- **Constants**: Use UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Interfaces**: Prefix with 'I' is optional, but be consistent

### Code Organization

```
src/
├── commands/        # Discord slash commands
├── events/          # Discord event handlers
├── handlers/        # Business logic handlers
├── utils/           # Utility functions
├── database/        # Database related code
├── types/           # TypeScript type definitions
├── config/          # Configuration management
├── security/        # Security middleware and validators
└── monitoring/      # Monitoring and metrics
```

### Best Practices

1. **Error Handling**
   ```typescript
   try {
     await riskyOperation();
   } catch (error) {
     logger.error('Operation failed', error as Error, { context });
     // Handle error appropriately
   }
   ```

2. **Async/Await**
   - Always use async/await instead of callbacks
   - Handle Promise rejections properly

3. **Database Queries**
   - Use parameterized queries to prevent SQL injection
   - Use transactions for multi-step operations
   - Always close connections properly

4. **Security**
   - Validate all user inputs
   - Use the security middleware for commands
   - Never log sensitive information
   - Follow the principle of least privilege

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

1. **Unit Tests**: Test individual functions and classes
   ```typescript
   describe('GiveawayHandler', () => {
     it('should create a giveaway successfully', async () => {
       // Test implementation
     });
   });
   ```

2. **Integration Tests**: Test interactions between components
   ```typescript
   describe('Giveaway Command', () => {
     it('should handle /giveaway create', async () => {
       // Test implementation
     });
   });
   ```

3. **Test Guidelines**
   - Write tests for all new features
   - Maintain at least 80% code coverage
   - Use descriptive test names
   - Mock external dependencies
   - Test error cases

## Pull Request Process

1. **Before Submitting**
   - Run `npm run lint` to check code style
   - Run `npm run typecheck` to check TypeScript
   - Run `npm test` to ensure tests pass
   - Update documentation if needed

2. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update

   ## Testing
   - [ ] Tests pass locally
   - [ ] Added new tests
   - [ ] Tested manually

   ## Checklist
   - [ ] Code follows style guidelines
   - [ ] Self-reviewed code
   - [ ] Updated documentation
   - [ ] No new warnings
   ```

3. **Review Process**
   - PRs require at least one review
   - Address all feedback
   - Keep PRs focused and small
   - Update PR based on feedback

## Commit Message Guidelines

We follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(giveaway): add custom embed builder
fix(security): resolve rate limiting issue
docs(readme): update installation instructions
test(handler): add unit tests for giveaway handler
```

## Reporting Bugs

### Security Vulnerabilities

**Do not report security vulnerabilities through public GitHub issues.**

Email security@yourdomain.com with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### Bug Reports

Use GitHub Issues with the bug report template:

1. **Title**: Clear and descriptive
2. **Description**: What happened vs what you expected
3. **Steps to Reproduce**: Detailed steps
4. **Environment**: Node version, OS, etc.
5. **Logs**: Relevant error messages
6. **Screenshots**: If applicable

## Feature Requests

Use GitHub Issues with the feature request template:

1. **Problem**: What problem does this solve?
2. **Solution**: Your proposed solution
3. **Alternatives**: Other solutions considered
4. **Additional Context**: Any other relevant information

## Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behaviors:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behaviors:**
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information
- Conduct which could reasonably be considered inappropriate

### Enforcement

Project maintainers will remove, edit, or reject comments, commits, code, wiki edits, issues, and other contributions that are not aligned with this Code of Conduct.

## Questions?

- Join our Discord server: [discord.gg/yourserver](https://discord.gg/yourserver)
- Check the documentation: [docs.yourdomain.com](https://docs.yourdomain.com)
- Email: support@yourdomain.com

## License

By contributing, you agree that your contributions will be licensed under the Apache License 2.0.