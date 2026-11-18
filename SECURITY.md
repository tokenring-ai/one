# Security Policy

## Supported versions

Security fixes are released for the latest published version of TokenRing One. Please update to the newest release before reporting.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Report vulnerabilities privately via GitHub's "Report a vulnerability" button on the [Security tab](https://github.com/tokenring-ai/one/security/advisories/new), or email the maintainers at <security@tokenring.ai>.

Include as much of the following as you can:

- A description of the issue and its impact
- Steps or a proof of concept to reproduce
- Affected version(s) and configuration

## What to expect

- Acknowledgement within 5 business days
- An assessment and remediation plan within 30 days
- Credit in the release notes if you wish

## Scope notes

TokenRing One is a local-first workspace: the server binds to `127.0.0.1` by default and auth applies to the web host. Reports involving the default localhost deployment, agent tool safety gates (shell, filesystem, browser allow-lists), secrets handling, and the RPC/WebSocket protocol are all in scope.
