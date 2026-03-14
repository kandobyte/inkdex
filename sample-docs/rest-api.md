---
title: REST API Reference
category: reference
---

# REST API Reference

## Base URL

All API requests are made to `https://api.acme.io/v1` for production and `https://sandbox.api.acme.io/v1` for sandbox. The API accepts JSON request bodies and returns JSON responses. Set the `Content-Type` header to `application/json` for all requests that include a body.

API versioning is handled through the URL path. The current version is `v1`. When breaking changes are introduced, a new version will be released and the previous version will be supported for at least 12 months. Non-breaking changes such as new fields in responses or new optional parameters are added to the current version without a version bump.

## Users

### List Users

Retrieve a paginated list of users in your organization. Results are ordered by creation date, with the most recently created users appearing first.

```
GET /v1/users?limit=20&starting_after=usr_abc123
```

Query parameters include `limit` (1-100, default 20), `starting_after` (cursor for forward pagination), `ending_before` (cursor for backward pagination), `email` (filter by exact email match), and `role` (filter by role: admin, member, or viewer).

The response includes a `data` array of user objects and a `has_more` boolean indicating whether additional pages exist. Each user object contains `id`, `email`, `name`, `role`, `status` (active, suspended, or invited), `created_at`, and `updated_at` timestamps.

### Create User

Invite a new user to your organization by sending a POST request with their email and role.

```
POST /v1/users
Content-Type: application/json

{
  "email": "jane@example.com",
  "name": "Jane Smith",
  "role": "member",
  "metadata": { "department": "engineering" }
}
```

The `email` and `role` fields are required. The `name` field is optional and can be updated later. The `metadata` field accepts an arbitrary JSON object for storing custom data associated with the user, up to 8 KB in size.

The newly created user receives an invitation email with a link to set their password. Their status is set to `invited` until they complete the onboarding flow, at which point it changes to `active`. Invitation links expire after 7 days. You can resend the invitation by calling the resend endpoint.

### Get User

Retrieve a single user by their ID.

```
GET /v1/users/usr_abc123
```

Returns the full user object including all metadata. If the user does not exist, a 404 Not Found error is returned with the error code `resource_not_found`.

### Update User

Update a user's name, role, or metadata. Only the fields included in the request body are modified; omitted fields remain unchanged.

```
PATCH /v1/users/usr_abc123
Content-Type: application/json

{
  "role": "admin",
  "metadata": { "department": "management" }
}
```

Changing a user's role takes effect immediately. If a user is downgraded from admin to member, they lose access to organization settings and billing information on their next API request. Metadata updates are merged with existing metadata — to remove a key, set its value to `null`.

### Delete User

Permanently remove a user from your organization. This action cannot be undone.

```
DELETE /v1/users/usr_abc123
```

Deleting a user revokes all their active sessions and access tokens. Their data is retained for 30 days for compliance purposes and can be retrieved through a support request during that period. After 30 days the data is permanently purged.

## Payments

### Create Payment

Initiate a payment by specifying the amount, currency, and payment method.

```
POST /v1/payments
Content-Type: application/json

{
  "amount": 5000,
  "currency": "usd",
  "payment_method": "pm_card_visa",
  "description": "Monthly subscription",
  "metadata": { "invoice_id": "inv_12345" }
}
```

Amounts are specified in the smallest currency unit (cents for USD, pence for GBP). The platform supports over 135 currencies. The `payment_method` field references a previously created payment method attached to a customer.

Payments are processed asynchronously. The initial response returns the payment object with a status of `processing`. Subscribe to the `payment.completed` or `payment.failed` webhook events to be notified of the outcome. Typical processing time is under 5 seconds for card payments and 1-3 business days for bank transfers.

### List Payments

Retrieve a paginated list of payments with optional filters.

```
GET /v1/payments?status=completed&created_after=2024-01-01T00:00:00Z&limit=50
```

Filters include `status` (processing, completed, failed, refunded), `created_after` and `created_before` for date ranges, `currency`, and `customer_id`. Results are ordered by creation date descending.

### Get Payment

Retrieve a single payment by ID, including its full history of status changes.

```
GET /v1/payments/pay_xyz789
```

The response includes a `timeline` array showing each status transition with timestamps, providing a complete audit trail of the payment lifecycle.

### Refund Payment

Issue a full or partial refund for a completed payment.

```
POST /v1/payments/pay_xyz789/refund
Content-Type: application/json

{
  "amount": 2500,
  "reason": "customer_request"
}
```

Omit the `amount` field to issue a full refund. Partial refunds can be issued multiple times until the total refunded amount equals the original payment amount. The `reason` field is optional and accepts values like `customer_request`, `duplicate`, or `fraudulent`. Refunds for card payments typically appear on the customer's statement within 5-10 business days.

## Organizations

### Get Organization

Retrieve details about your organization including billing plan, usage quotas, and member count.

```
GET /v1/organization
```

The response includes `id`, `name`, `plan` (free, starter, business, enterprise), `member_count`, `api_call_quota`, `api_calls_used`, `webhook_endpoints_limit`, and `created_at`. Usage counters reset at the beginning of each billing cycle.

### Update Organization

Update organization settings such as name, default timezone, and notification preferences.

```
PATCH /v1/organization
Content-Type: application/json

{
  "name": "Acme Corp",
  "default_timezone": "America/New_York",
  "notification_email": "ops@acme.com"
}
```

Only organization admins can update these settings. The `notification_email` receives billing alerts, security notifications, and scheduled maintenance announcements.
