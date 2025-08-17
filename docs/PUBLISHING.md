# Publishing Guide

## Prerequisites
- npm account with publish permissions
- GitHub repository access
- GPG key for signed commits (optional)

## Publishing Process

### 1. Pre-release Checklist
- [ ] All tests passing
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped in package.json

### 2. Create Release

```bash
# For patch release (0.1.0 -> 0.1.1)
npm run release

# For minor release (0.1.0 -> 0.2.0)
npm run release:minor

# For major release (0.1.0 -> 1.0.0)
npm run release:major
```

### 3. Publish to npm

```bash
npm publish --access public
```

### 4. Create GitHub Release
- Go to GitHub releases
- Create new release from tag
- Add release notes
- Publish release

## Automated Release Process

When you push a tag that starts with `v` (e.g., `v1.0.0`), the GitHub Actions workflow will automatically:

1. Run all tests
2. Build the project
3. Publish to npm registry
4. Create a GitHub release with generated release notes

### Setting up Automation

1. **Add NPM Token to GitHub Secrets:**
   - Get your npm token: `npm token create`
   - Add to GitHub: Settings → Secrets → New repository secret
   - Name: `NPM_TOKEN`
   - Value: Your npm token

2. **Create and Push a Tag:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Manual Publishing Steps

### 1. Clean and Build
```bash
npm run clean
npm install
npm run build
```

### 2. Run Tests
```bash
npm run test:all
```

### 3. Verify Build
```bash
node scripts/verify-build.js
```

### 4. Dry Run
```bash
npm pack --dry-run
```

### 5. Publish
```bash
npm publish --access public
```

## Troubleshooting

### Common Issues

1. **Authentication Failed:**
   ```bash
   npm login
   ```

2. **Package Name Already Exists:**
   - Update package name in package.json
   - Or request ownership transfer

3. **Build Verification Failed:**
   - Ensure all required files are in dist/
   - Check tsup.config.ts configuration

4. **Tests Failing:**
   ```bash
   npm run test:unit -- --watch
   npm run test:integration -- --watch
   ```

## Version Management

### Semantic Versioning
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backwards compatible
- **PATCH** (0.0.1): Bug fixes, backwards compatible

### Pre-release Versions
```bash
# Beta release
npm version prerelease --preid=beta
# v1.0.0-beta.0

# RC release
npm version prerelease --preid=rc
# v1.0.0-rc.0
```

## Post-Release Checklist

- [ ] Verify npm package is available
- [ ] Test installation: `npm install @mcp/dev-orchestrator`
- [ ] Update documentation if needed
- [ ] Announce release (Twitter, Discord, etc.)
- [ ] Monitor issues for any problems

## Security Considerations

1. **Never commit sensitive data:**
   - API keys
   - Tokens
   - Passwords

2. **Use npm 2FA:**
   ```bash
   npm profile enable-2fa auth-and-writes
   ```

3. **Audit dependencies:**
   ```bash
   npm audit
   npm audit fix
   ```

## Support

For issues or questions about publishing:
- Open an issue on GitHub
- Contact the maintainers
- Check the [CONTRIBUTING.md](../CONTRIBUTING.md) guide