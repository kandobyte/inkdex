---
title: Webhooks
category: integration
---

# Webhooks

## Overview

Webhooks deliver real-time notifications to your application when events occur in the Acme platform. Instead of polling the API for changes, you register an endpoint URL and the platform sends HTTP POST requests to that URL whenever a subscribed event fires. This reduces latency and API usage compared to polling-based integrations.

Each webhook delivery includes a JSON payload describing the event, the affected resource, and metadata about the delivery attempt. Your endpoint must respond with a 2xx status code within 30 seconds to acknowledge receipt. Any other response or a timeout is treated as a failure and triggers the retry mechanism.

## Configuring Endpoints

Create a webhook endpoint from the Developer Dashboard or through the API. Each endpoint requires a URL and a list of event types to subscribe to.

```
POST /v1/webhook_endpoints
Content-Type: application/json

{
  "url": "https://your-app.com/webhooks/acme",
  "events": ["user.created", "user.deleted", "payment.completed", "payment.failed"],
  "description": "Production webhook handler"
}
```

The URL must use HTTPS. Plain HTTP endpoints are rejected to ensure payload confidentiality. You can register up to 20 endpoints per application on the business plan and 5 on the starter plan. Each endpoint can subscribe to any combination of event types.

To update an endpoint's subscribed events or URL, use the PATCH method. To temporarily stop deliveries without deleting the endpoint, set its `status` to `disabled`. Re-enable it by setting the status back to `enabled`. Events that fire while an endpoint is disabled are not queued or delivered retroactively.

## Event Types

The platform emits events across several resource categories. Each event type follows the pattern `resource.action`. Here are the available event types:

User events include `user.created` when a new user is invited, `user.updated` when a user's profile or role changes, `user.deleted` when a user is removed, and `user.activated` when an invited user completes onboarding.

Payment events include `payment.completed` when a payment is successfully processed, `payment.failed` when a payment is declined or errors out, `payment.refunded` when a full refund is issued, and `payment.partially_refunded` when a partial refund is processed.

Organization events include `organization.updated` when settings change and `organization.plan_changed` when the billing plan is upgraded or downgraded.

Webhook events include `webhook_endpoint.created`, `webhook_endpoint.updated`, and `webhook_endpoint.deleted` for managing webhook infrastructure programmatically.

## Payload Format

Every webhook delivery sends a POST request with a JSON body containing the event details:

```json
{
  "id": "evt_1a2b3c4d",
  "type": "payment.completed",
  "created_at": "2024-06-15T14:30:00Z",
  "data": {
    "id": "pay_xyz789",
    "amount": 5000,
    "currency": "usd",
    "status": "completed",
    "customer_id": "cus_abc123"
  },
  "metadata": {
    "webhook_endpoint_id": "we_endpoint1",
    "delivery_attempt": 1,
    "sandbox": false
  }
}
```

The `id` field is unique per event and can be used for idempotency checks. The `type` field matches the subscribed event type. The `data` field contains the full resource object at the time the event fired. The `metadata` field includes delivery information such as the attempt number and whether the event originated from the sandbox environment.

## Verifying Signatures

Every webhook delivery includes a signature in the `X-Acme-Signature` header. Verify this signature to confirm the request came from Acme and was not tampered with in transit. Failing to verify signatures makes your endpoint vulnerable to spoofed requests.

The signature is computed as an HMAC-SHA256 of the raw request body using your endpoint's signing secret. The signing secret is generated when you create the endpoint and can be viewed in the dashboard.

To verify the signature, compute the HMAC-SHA256 of the raw request body using your signing secret and compare it to the value in the header using a constant-time comparison function. Here is an example in Node.js:

```javascript
import crypto from "crypto";

function verifyWebhookSignature(body, signature, secret) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}
```

Always use the raw request body for signature verification, not a parsed and re-serialized version, as JSON serialization is not guaranteed to preserve field ordering or whitespace.

## Retry Behavior

When a delivery fails (non-2xx response or timeout), the platform retries with exponential backoff. The retry schedule is: 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours, and 24 hours. After 6 failed attempts the delivery is marked as permanently failed and no further retries are attempted.

You can view delivery history and manually retry failed deliveries from the dashboard. Each delivery attempt is logged with the response status code, response body (first 1 KB), response time, and any connection errors.

If an endpoint accumulates more than 100 consecutive failures, it is automatically disabled and you receive an email notification. Re-enable it from the dashboard after fixing the underlying issue. The failure counter resets after any successful delivery.

## Handling Webhooks at Scale

For high-throughput applications receiving hundreds of webhooks per second, consider these architectural patterns. Use a message queue like SQS or RabbitMQ to decouple webhook receipt from processing. Your endpoint should accept the request, enqueue the payload, and return a 200 response immediately. A separate worker processes events from the queue at its own pace.

Implement idempotency using the event `id` field. Store processed event IDs in a database or cache with a TTL matching your retry window (at least 24 hours). Before processing an event, check whether the ID has already been handled. This prevents duplicate processing when retries deliver the same event multiple times.

Order of delivery is not guaranteed. Events may arrive out of order, especially during retries. Design your handlers to be order-independent or use the `created_at` timestamp to detect and handle stale events. For example, if you receive a `user.updated` event with an older timestamp than the one you already processed, you can safely discard it.
