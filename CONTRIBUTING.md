# Contributing to Pegasus Discord Bot

First off, thank you for considering contributing to Pegasus! It's people like you that make Pegasus such a great tool. We welcome contributions from everyone, regardless of their experience level.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Style Guidelines](#style-guidelines)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Community](#community)

## 📜 Code of Conduct

This project and everyone participating in it is governed by the [Pegasus Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 🚀 Getting Started

Before you begin:
- Have you read the [code of conduct](CODE_OF_CONDUCT.md)?
- Check if your issue/idea has already been [reported](https://github.com/cptcr/pegasus/issues)
- Check if your idea fits with the scope and aims of the project

## 🤝 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs if possible**
- **Include your environment details** (OS, Node.js version, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior** and **explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Your First Code Contribution

Unsure where to begin contributing? You can start by looking through these issues:

- Issues labeled `good first issue` - issues which should only require a few lines of code
- Issues labeled `help wanted` - issues which need extra attention
- Issues labeled `documentation` - issues related to improving documentation

## 💻 Development Setup

1. **Fork the repository**
   ```bash
   # Click the 'Fork' button on the GitHub repository page
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/pegasus.git
   cd pegasus
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/cptcr/pegasus.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

6. **Set up your development environment**
   - Copy `.env.example` to `.env`
   - Fill in your development bot token and database credentials
   - Set up a local PostgreSQL database

7. **Run the development server**
   ```bash
   npm run dev
   ```

## 📝 Style Guidelines

### TypeScript Style Guide

We use TypeScript for all code. Please follow these guidelines:

- Use 2 spaces for indentation
- Use semicolons
- Use single quotes for strings (except to avoid escaping)
- Use `const` by default, `let` when reassignment is needed, never `var`
- Prefer arrow functions over function expressions
- Use meaningful variable and function names
- Add JSDoc comments for functions and complex logic

Example:
```typescript
/**
 * Calculates user XP for the next level
 * @param currentLevel - The user's current level
 * @param baseXP - The base XP required for level 1
 * @returns The XP required for the next level
 */
const calculateNextLevelXP = (currentLevel: number, baseXP: number): number => {
  return baseXP * Math.pow(1.5, currentLevel);
};
```

### File Structure

- Commands go in `src/commands/{category}/{commandName}.ts`
- Event handlers go in `src/events/{eventName}.ts`
- Utility functions go in `src/utils/{utilityName}.ts`
- Database schemas go in `src/database/schema/{schemaName}.ts`
- Services go in `src/services/{serviceName}.ts`

### Internationalization (i18n)

All user-facing strings must support internationalization:

```typescript
// Good
await interaction.reply(i18n.t('commands.xp.rank.response', { 
  level: userLevel, 
  xp: currentXP 
}));

// Bad
await interaction.reply(`You are level ${userLevel} with ${currentXP} XP!`);
```

Remember to add translations for all supported languages:
- English (en)
- German (de)
- Spanish (es)
- French (fr)

## 📤 Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that don't affect the code's meaning
- **refactor**: Code change that neither fixes a bug nor adds a feature
- **perf**: Code change that improves performance
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools

### Examples

```bash
feat(xp): add voice channel XP multiplier configuration
fix(tickets): resolve issue with ticket panel not loading
docs(readme): update installation instructions
refactor(database): optimize user query performance
```

## 🔄 Pull Request Process

1. **Ensure your code follows the style guidelines**
2. **Update the README.md** with details of changes to the interface, if applicable
3. **Add or update tests** as appropriate
4. **Update documentation** for any changed functionality
5. **Ensure all tests pass**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```
6. **Update translations** for all supported languages if you've added new user-facing strings
7. **Make sure your commits follow the commit guidelines**
8. **Submit the pull request**

### Pull Request Template

When creating a PR, please use this template:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have tested this code locally
- [ ] I have added tests that prove my fix/feature works
- [ ] All new and existing tests pass

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] I have added translations for all supported languages
- [ ] My changes generate no new warnings
```

## 🌟 Recognition

Contributors who make significant contributions will be:
- Added to the contributors list
- Mentioned in release notes
- Given credit in the project documentation

## 💬 Community

- **Discord**: Join our [support server](https://discord.gg/vaultscope)
- **GitHub Discussions**: Participate in [discussions](https://github.com/cptcr/pegasus/discussions)
- **Issues**: Check our [issue tracker](https://github.com/cptcr/pegasus/issues)

## ❓ Questions?

Feel free to ask questions in:
- Our [Discord server](https://discord.gg/vaultscope)
- GitHub Discussions
- By creating an issue with the `question` label

Thank you for contributing to Pegasus! 🚀