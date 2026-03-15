# Authentication

## Overview

Mira uses Bearer token authentication for all API requests. The client sends the token in the `Authorization: Bearer <token>` header on every request. Two credential types are supported: API keys (long-lived) and short-lived tokens (issued via token exchange).

For most use cases, API keys are sufficient. Use short-lived tokens when you need to issue time-limited credentials to untrusted code, provide access to a specific collection only, or comply with a security policy that prohibits long-lived credentials.

All credential types use the same `apiKey` field in the `MiraClient` constructor. The API does not distinguish between key types at the transport level.

## API Keys

### Generating an API Key

API keys are created in the Mira dashboard. Navigate to **Settings → API Keys** and click **Create key**. Provide a descriptive name (e.g., `production-backend`, `ci-pipeline`) to identify the key's purpose later. You can optionally restrict the key to specific collections or to read-only access.

The key is shown only once at creation time. Copy it immediately and store it in a secrets manager or environment variable. If you lose the key, you must revoke it and create a new one.

Keys are associated with your account, not a specific project. If multiple team members need access, give each person their own key so that individual access can be revoked without affecting others.

### Rotating API Keys

API keys should be rotated periodically or immediately if you suspect a key has been compromised. To rotate a key:

1. Create a new API key in the Mira dashboard.
2. Update your application's environment variable or secrets manager with the new key.
3. Deploy the updated configuration to all running instances.
4. Verify that your application is functioning correctly with the new key.
5. Revoke the old key in the dashboard under **Settings → API Keys → Revoke**.

Do not revoke the old key before your application is confirmed working with the new one. Revoking first causes a gap where all requests fail.

For zero-downtime rotation in Kubernetes or similar environments, update the secret value and perform a rolling restart. All pods will pick up the new key as they restart.

### Key Scopes

When creating a key, you can restrict it to a subset of permissions:

| Scope | Description |
|-------|-------------|
| `read` | Can search and fetch vectors. Cannot insert, update, or delete. |
| `write` | Can insert, update, delete, and search. Cannot create or drop collections. |
| `admin` | Full access including collection management and account settings. |

Use the narrowest scope that satisfies your use case. CI pipelines that only run evaluations should use `read`-scoped keys. Application backends typically need `write`. Only give `admin` to infrastructure tooling.

## Role-Based Access Control

### Built-in Roles

Mira provides three built-in roles that map to the key scopes above:

- **Viewer**: Can search collections and fetch vector metadata. Read-only access.
- **Editor**: Can insert, update, and delete vectors. Cannot manage collections or account settings.
- **Admin**: Full access to all resources and settings.

Built-in roles apply account-wide. To restrict access to a specific collection, use collection-scoped API keys (set when creating the key) rather than account-level roles.

### Custom Roles

Enterprise accounts can define custom roles with fine-grained permissions per collection. A custom role is defined as a list of permission statements:

```json
{
  "name": "search-only-docs",
  "permissions": [
    { "resource": "collection:documents", "actions": ["search", "fetch"] },
    { "resource": "collection:archived", "actions": [] }
  ]
}
```

Custom roles are managed via the Mira dashboard under **Settings → Roles**, or via the management API. Assign a custom role to an API key by selecting it from the **Role** dropdown during key creation.

Custom roles cannot grant more permissions than the creator's own role. An Editor cannot create a custom role with Admin permissions.

## Token Expiration and Refresh

Short-lived tokens are issued via the token exchange endpoint. They expire after a configurable duration (default 1 hour, minimum 5 minutes, maximum 24 hours). Expired tokens cause requests to fail with `MiraAuthenticationError: 401 Unauthorized`.

To exchange your API key for a short-lived token:

```typescript
const response = await fetch('https://api.mira-db.com/v1/auth/token', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${process.env.MIRA_API_KEY}` },
  body: JSON.stringify({ expiresIn: 3600 }), // seconds
});
const { token, expiresAt } = await response.json();
```

The response includes an `expiresAt` ISO timestamp. Your application is responsible for refreshing tokens before they expire. A common pattern is to refresh when less than 5 minutes remain:

```typescript
async function getToken() {
  if (!cachedToken || Date.now() > cachedToken.expiresAt - 5 * 60 * 1000) {
    cachedToken = await exchangeToken();
  }
  return cachedToken.token;
}
```

`MiraClient` does not automatically refresh tokens. You must create a new client instance (or update the `apiKey` field) with the refreshed token.

## Using Authentication in CI/CD

For CI pipelines, store your API key as a secret in your CI provider (GitHub Actions secrets, GitLab CI variables, etc.) and inject it as an environment variable at runtime. Never commit API keys to source control.

**GitHub Actions example:**

```yaml
- name: Run eval
  env:
    MIRA_API_KEY: ${{ secrets.MIRA_API_KEY }}
  run: npm run eval
```

For CI pipelines that only read data (running evaluations, checking collection stats), use a `read`-scoped key. This limits the blast radius if the key is accidentally exposed in build logs.

If your CI environment cannot use environment variables (e.g., it inlines all configuration into a config file), use a secrets manager like HashiCorp Vault or AWS Secrets Manager and fetch the key at job start. Avoid baking keys into Docker images or build artifacts.
