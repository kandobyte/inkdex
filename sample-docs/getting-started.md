---
title: Getting Started
category: guides
---

# Getting Started

## Introduction

Acme Platform is a developer API for building integrations that manage users, process payments, and automate workflows. The platform exposes a RESTful API alongside real-time event delivery through webhooks. All communication happens over HTTPS, and every request must be authenticated using an API key or OAuth 2.0 access token.

This guide walks you through creating an account, obtaining credentials, and making your first API call. By the end you will have a working integration that can list users in your organization.

## Creating an Account

Visit the Acme Developer Portal at developers.acme.io and click "Sign Up". You will need a valid email address and a phone number for two-factor authentication. After verifying your email, you are taken to the dashboard where you can create your first application.

Each application gets a unique client ID and client secret. Store the client secret securely — it is shown only once during creation. If you lose it, you must rotate credentials from the dashboard, which invalidates the previous secret immediately.

## Installing the SDK

Acme provides official SDKs for JavaScript, Python, and Go. Install the SDK for your language of choice:

For JavaScript, run `npm install @acme/sdk` in your project. The package requires Node.js 18 or later and ships with full TypeScript type definitions. For Python, run `pip install acme-sdk`. The package supports Python 3.10 and above. For Go, run `go get github.com/acme/sdk-go`. The module requires Go 1.21 or later.

All SDKs handle authentication, request signing, retries, and error parsing automatically. You can also use the REST API directly with any HTTP client if you prefer not to use an SDK.

## Making Your First Request

Initialize the SDK with your API key and make a request to list users in your organization:

```javascript
import { AcmeClient } from "@acme/sdk";

const client = new AcmeClient({ apiKey: "sk_live_your_key_here" });
const users = await client.users.list({ limit: 10 });
console.log(users.data);
```

The response includes a `data` array containing user objects and pagination metadata. Each user object contains fields like `id`, `email`, `name`, `role`, and `created_at`. Pagination is cursor-based — use the `starting_after` parameter with the last user's ID to fetch the next page.

## Environment Configuration

The platform supports two environments: sandbox and production. Sandbox is a fully functional replica of the production environment with simulated data. Use the sandbox to develop and test your integration without affecting real data or incurring charges.

Sandbox API keys start with `sk_test_` while production keys start with `sk_live_`. The base URLs are `https://sandbox.api.acme.io/v1` for sandbox and `https://api.acme.io/v1` for production. SDKs detect the environment automatically from the key prefix.

Sandbox has relaxed rate limits (1000 requests per minute versus 200 in production) and does not enforce payment method validation. Webhook events in sandbox are delivered to your configured endpoints with a `sandbox: true` flag in the metadata.

## Next Steps

Now that you have a working integration, explore these topics to build out your application. Read the Authentication guide to learn about OAuth 2.0 flows for acting on behalf of users. Check the REST API Reference for the full list of endpoints and parameters. Set up Webhooks to receive real-time notifications when resources change. Review Rate Limiting to understand throttling behavior and best practices for high-throughput integrations.
