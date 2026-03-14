---
title: SDK Reference
category: reference
---

# SDK Reference

## Overview

Acme provides official SDKs for JavaScript, Python, and Go. Each SDK wraps the REST API with idiomatic methods, handles authentication and request signing, implements automatic retries with exponential backoff, and parses error responses into typed exceptions. Using an SDK is recommended over raw HTTP calls for most integrations.

All SDKs follow semantic versioning. Breaking changes are released only in major versions and are documented in the changelog. Minor and patch versions add new features and bug fixes without breaking existing code.

## JavaScript SDK

The JavaScript SDK is distributed as `@acme/sdk` on npm and supports Node.js 18 and later. It is written in TypeScript and ships with type definitions for all request and response objects.

### Installation and Setup

```bash
npm install @acme/sdk
```

Initialize the client with your API key or OAuth access token:

```javascript
import { AcmeClient } from "@acme/sdk";

const client = new AcmeClient({
  apiKey: "sk_live_your_key_here",
  timeout: 10000, // request timeout in milliseconds
  maxRetries: 3,  // number of automatic retries
});
```

The `timeout` option sets the maximum time to wait for a response before aborting the request. The `maxRetries` option controls how many times failed requests are retried. Only network errors and 5xx responses are retried; 4xx errors are not retried because they indicate a problem with the request itself.

### Making Requests

Every resource is available as a property on the client with standard CRUD methods:

```javascript
// List users with pagination
const page1 = await client.users.list({ limit: 20 });
const page2 = await client.users.list({ limit: 20, starting_after: page1.data.at(-1).id });

// Create a user
const user = await client.users.create({ email: "jane@example.com", role: "member" });

// Update a user
await client.users.update(user.id, { role: "admin" });

// Delete a user
await client.users.delete(user.id);

// Create a payment
const payment = await client.payments.create({
  amount: 5000,
  currency: "usd",
  payment_method: "pm_card_visa",
});
```

All methods return promises. List methods return an object with a `data` array and `has_more` boolean. Create and update methods return the full resource object. Delete methods return a confirmation object with the resource ID and a `deleted: true` flag.

### Error Handling

The SDK throws typed errors for different failure scenarios:

```javascript
import { AcmeError, AuthenticationError, RateLimitError, NotFoundError } from "@acme/sdk";

try {
  await client.users.get("usr_nonexistent");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("User not found:", err.message);
  } else if (err instanceof AuthenticationError) {
    console.log("Invalid credentials:", err.message);
  } else if (err instanceof RateLimitError) {
    console.log("Rate limited, retry after:", err.retryAfter, "seconds");
  } else if (err instanceof AcmeError) {
    console.log("API error:", err.code, err.message);
  }
}
```

Each error includes the HTTP status code, error code, human-readable message, and the request ID for debugging. Rate limit errors additionally include a `retryAfter` property indicating when the next request will be accepted.

## Python SDK

The Python SDK is distributed as `acme-sdk` on PyPI and supports Python 3.10 and above. It provides both synchronous and asynchronous clients.

### Installation and Setup

```bash
pip install acme-sdk
```

Initialize the synchronous or async client:

```python
from acme import AcmeClient, AsyncAcmeClient

# Synchronous
client = AcmeClient(api_key="sk_live_your_key_here")

# Asynchronous
async_client = AsyncAcmeClient(api_key="sk_live_your_key_here")
```

The async client uses `httpx` under the hood and should be used with `await` in async contexts. Both clients accept the same configuration options including `timeout`, `max_retries`, and `base_url`.

### Making Requests

```python
# List users
users = client.users.list(limit=20)
for user in users.data:
    print(user.email)

# Create a payment
payment = client.payments.create(
    amount=5000,
    currency="usd",
    payment_method="pm_card_visa"
)

# Async version
users = await async_client.users.list(limit=20)
payment = await async_client.payments.create(amount=5000, currency="usd", payment_method="pm_card_visa")
```

Response objects use dataclasses with type hints for IDE autocompletion. All datetime fields are returned as `datetime` objects in UTC.

### Error Handling

```python
from acme.errors import AcmeError, AuthenticationError, RateLimitError, NotFoundError

try:
    user = client.users.get("usr_nonexistent")
except NotFoundError as e:
    print(f"User not found: {e.message}")
except RateLimitError as e:
    print(f"Rate limited, retry after {e.retry_after} seconds")
except AcmeError as e:
    print(f"API error: {e.code} - {e.message}")
```

## Go SDK

The Go SDK is available as `github.com/acme/sdk-go` and requires Go 1.21 or later. It uses Go generics for type-safe responses and the standard `context` package for cancellation and timeouts.

### Installation and Setup

```bash
go get github.com/acme/sdk-go
```

Initialize the client:

```go
package main

import (
    "context"
    "fmt"
    acme "github.com/acme/sdk-go"
)

func main() {
    client := acme.NewClient("sk_live_your_key_here",
        acme.WithTimeout(10 * time.Second),
        acme.WithMaxRetries(3),
    )

    users, err := client.Users.List(context.Background(), &acme.ListParams{Limit: 20})
    if err != nil {
        var apiErr *acme.Error
        if errors.As(err, &apiErr) {
            fmt.Printf("API error: %s (code: %s)\n", apiErr.Message, apiErr.Code)
        }
        return
    }

    for _, user := range users.Data {
        fmt.Println(user.Email)
    }
}
```

The Go SDK uses functional options for client configuration and returns errors following Go conventions rather than throwing exceptions. Use `errors.As` to check for specific API error types.

## SDK Feature Comparison

All three SDKs provide the same core functionality with language-idiomatic differences. Automatic pagination helpers are available in all SDKs to iterate through large result sets without manually handling cursors. Webhook signature verification utilities are included in all SDKs as helper functions. Request logging can be enabled by passing a custom logger to the client constructor for debugging during development.
