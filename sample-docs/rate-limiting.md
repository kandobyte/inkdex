---
title: Rate Limiting
category: operations
---

# Rate Limiting

## Overview

The Acme API enforces rate limits to ensure fair usage and protect platform stability. Rate limits are applied per API key or OAuth access token, not per IP address. When you exceed the limit, the API returns a 429 Too Many Requests response and includes headers indicating when you can retry.

Rate limiting is applied using a sliding window algorithm. This means your available quota replenishes gradually rather than resetting all at once at a fixed interval. The sliding window approach prevents traffic spikes that would occur if all clients reset simultaneously.

## Limits by Plan

Rate limits vary by billing plan:

The free plan allows 20 requests per minute. The starter plan allows 100 requests per minute. The business plan allows 200 requests per minute. The enterprise plan has custom limits configured during onboarding, typically between 500 and 5000 requests per minute depending on the contracted volume.

Sandbox environments have relaxed limits of 1000 requests per minute across all plans to facilitate development and testing without hitting throttling during rapid iteration.

All plans share the same per-endpoint limits for expensive operations. Bulk export endpoints are limited to 10 requests per minute regardless of plan. Search endpoints are limited to 60 requests per minute. Payment creation endpoints are limited to 100 requests per minute to prevent accidental duplicate charges.

## Rate Limit Headers

Every API response includes headers that communicate your current rate limit status:

`X-RateLimit-Limit` shows your total allowed requests per minute. `X-RateLimit-Remaining` shows how many requests you have left in the current window. `X-RateLimit-Reset` contains a Unix timestamp indicating when the window resets. `X-RateLimit-Used` shows how many requests you have consumed in the current window.

When you receive a 429 response, the `Retry-After` header contains the number of seconds to wait before making another request. The response body includes the error code `rate_limit_exceeded` and a human-readable message.

## Handling Rate Limits

The recommended approach for handling rate limits is to implement exponential backoff with jitter. When you receive a 429 response, wait for the duration specified in the `Retry-After` header plus a small random delay (jitter) to avoid thundering herd problems when multiple clients are throttled simultaneously.

Here is an example implementation in JavaScript:

```javascript
async function requestWithBackoff(fn, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status !== 429 || attempt === maxRetries - 1) throw err;
      const retryAfter = err.retryAfter || Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      await new Promise((r) => setTimeout(r, retryAfter * 1000 + jitter));
    }
  }
}
```

The official SDKs handle rate limiting automatically when `maxRetries` is configured. They respect the `Retry-After` header and add jitter to retry delays. If you are using the REST API directly, implement similar logic in your HTTP client.

## Best Practices for High Throughput

If your integration needs to make a high volume of API calls, consider these strategies to stay within your limits.

Batch operations where possible. Instead of creating users one at a time, use the bulk create endpoint which accepts up to 100 users in a single request and counts as one request toward your rate limit.

Cache responses locally. User profiles and organization settings change infrequently. Cache these responses for a reasonable duration (5-15 minutes) and serve subsequent requests from cache rather than making API calls.

Use webhooks instead of polling. If you are polling an endpoint to detect changes, switch to webhooks. Webhooks deliver changes in real time without consuming your rate limit. A single webhook subscription replaces thousands of polling requests per day.

Spread requests evenly over time. If you need to process a large dataset, distribute requests evenly across the rate window rather than sending bursts. For example, with a 200 requests per minute limit, aim for approximately 3 requests per second with consistent spacing.

Monitor your usage through the `X-RateLimit-Remaining` header. Proactively slow down requests when the remaining quota drops below 20% to avoid hitting the hard limit. This adaptive approach provides smoother throughput than waiting for 429 responses.

## Requesting Higher Limits

If your integration consistently needs more throughput than your plan allows, contact the sales team to discuss enterprise pricing with custom rate limits. Include your current usage patterns, expected growth, and peak traffic requirements. Temporary limit increases are available for planned events like product launches or sales campaigns — request them at least 48 hours in advance through the support portal.
