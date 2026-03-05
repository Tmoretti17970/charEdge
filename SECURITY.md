# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 11.x    | ✅ Active support   |
| 10.x    | ⚠️ Critical patches |
| < 10    | ❌ End of life      |

## Reporting a Vulnerability

We take the security of charEdge seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Email:** Send details to **security@charedge.app**
2. **Subject:** `[SECURITY] Brief description`
3. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

| Timeframe | Action |
|-----------|--------|
| 24 hours  | Acknowledgment of your report |
| 72 hours  | Initial assessment and severity classification |
| 7 days    | Fix in progress for critical/high severity |
| 30 days   | Public disclosure (coordinated with reporter) |

### Severity Classification

- **Critical:** Remote code execution, data exfiltration, auth bypass
- **High:** XSS, CSRF, privilege escalation, API key exposure
- **Medium:** Information disclosure, denial of service
- **Low:** Best practice violations, minor information leaks

### Scope

The following are in scope:
- charEdge web application
- charEdge API endpoints
- Authentication and authorization systems
- Client-side data handling
- WebSocket connections

### Safe Harbor

We will not pursue legal action against security researchers who:
- Act in good faith
- Avoid privacy violations and data destruction
- Report findings promptly
- Allow reasonable time for remediation before disclosure

### Recognition

We maintain a security Hall of Fame for responsible disclosures. Reporters of valid vulnerabilities will be credited (with permission) in our release notes.

## Security Best Practices

### For Contributors

- Never commit API keys, secrets, or credentials
- Use environment variables for all sensitive values
- Validate all user input server-side
- Follow the principle of least privilege
- Keep dependencies up to date

### For Users

- Use strong, unique passwords
- Enable two-factor authentication when available
- Keep your API keys confidential
- Report suspicious activity immediately
