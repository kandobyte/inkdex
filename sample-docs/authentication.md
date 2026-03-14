---
title: Authentication
category: security
---

# Authentication

## Overview

Every request to the Acme API must be authenticated. The platform supports two authentication methods: API keys for server-to-server communication and OAuth 2.0 for applications acting on behalf of users. Both methods result in a bearer token that is sent in the Authorization header of every request.

Unauthenticated requests receive a 401 Unauthorized response with an error code of `authentication_required`. Requests with expired or revoked credentials receive a 401 response with an error code of `token_expired` or `token_revoked` respectively.

## API Key Authentication

API keys are the simplest way to authenticate. Generate a key from the Acme Developer Dashboard under the "API Keys" section. Each key is scoped to a specific environment (sandbox or production) and cannot be used across environments.

Include the key in the Authorization header as a bearer token:

```
Authorization: Bearer sk_live_your_key_here
```

API keys have full access to all resources owned by the application. They should only be used in server-side code and never exposed in client-side applications, mobile apps, or version control. If a key is compromised, rotate it immediately from the dashboard. Rotation generates a new key and invalidates the old one after a configurable grace period of up to 24 hours.

You can create multiple API keys per application to support key rotation without downtime. Each key can optionally be restricted to specific IP addresses using CIDR notation in the dashboard. Restricted keys that are used from unauthorized IP addresses receive a 403 Forbidden response.

## OAuth 2.0 Authorization Code Flow

For applications that need to act on behalf of users, implement the OAuth 2.0 authorization code flow. This is the recommended approach for web applications where users grant your application permission to access their Acme resources.

The flow begins by redirecting the user to the Acme authorization endpoint:

```
https://auth.acme.io/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT_URI&response_type=code&scope=users:read+payments:write&state=RANDOM_STATE
```

The `scope` parameter specifies which permissions your application is requesting. Available scopes include `users:read`, `users:write`, `payments:read`, `payments:write`, `webhooks:manage`, and `organization:admin`. Request only the scopes your application needs — users are more likely to approve minimal permission requests.

After the user approves, Acme redirects back to your redirect URI with an authorization code. Exchange this code for an access token by making a POST request to the token endpoint:

```
POST https://auth.acme.io/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=AUTH_CODE&redirect_uri=YOUR_REDIRECT_URI&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

The response includes an `access_token`, a `refresh_token`, the granted `scope`, and an `expires_in` value in seconds. Access tokens expire after one hour. Use the refresh token to obtain new access tokens without requiring the user to re-authorize.

## OAuth 2.0 Client Credentials Flow

For machine-to-machine integrations where no user context is needed, use the client credentials flow. This flow exchanges your client ID and secret directly for an access token scoped to your application.

```
POST https://auth.acme.io/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&scope=users:read+payments:read
```

Tokens obtained through the client credentials flow have the same expiration and refresh behavior as authorization code tokens. However, they cannot access user-specific resources and are limited to application-level operations.

## Token Refresh

Access tokens expire after one hour. To obtain a new access token without user interaction, send the refresh token to the token endpoint:

```
POST https://auth.acme.io/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token=YOUR_REFRESH_TOKEN&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

Refresh tokens are valid for 30 days and are single-use. Each refresh request returns a new refresh token alongside the new access token. If a refresh token is used more than once, all tokens in the chain are revoked as a security precaution, and the user must re-authorize.

Store refresh tokens securely with the same care as client secrets. Never log refresh tokens or include them in error reports.

## Token Introspection

To check whether a token is still valid and inspect its metadata, use the introspection endpoint:

```
POST https://auth.acme.io/introspect
Content-Type: application/x-www-form-urlencoded

token=ACCESS_TOKEN&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET
```

The response indicates whether the token is active and includes the granted scopes, expiration time, and the user ID associated with the token. Use introspection to validate tokens received from third parties or to debug authorization issues.

## Security Best Practices

Always use HTTPS for all API communication. The platform rejects requests made over plain HTTP with a 301 redirect to the HTTPS equivalent, but you should never rely on this redirect in production code.

Implement the principle of least privilege when requesting OAuth scopes. Store all credentials (API keys, client secrets, refresh tokens) in a secure secrets manager rather than environment variables or configuration files. Rotate API keys regularly, even if they have not been compromised. Monitor the security log in the dashboard for unusual authentication patterns such as failed login attempts or token usage from unexpected IP addresses.

Enable IP restrictions on API keys when your server infrastructure has stable IP addresses. Use short-lived access tokens and refresh them programmatically rather than creating long-lived API keys for OAuth-based integrations.
