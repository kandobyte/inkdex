---
title: Error Handling
category: reference
---

# Error Handling

## Error Response Format

All API errors return a consistent JSON response body with the following structure:

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "parameter_missing",
    "message": "The 'email' field is required when creating a user.",
    "param": "email",
    "request_id": "req_1a2b3c4d"
  }
}
```

The `type` field categorizes the error at a high level. The `code` field provides a machine-readable identifier for the specific error condition. The `message` field contains a human-readable description suitable for logging but not for displaying directly to end users. The `param` field, when present, indicates which request parameter caused the error. The `request_id` field uniquely identifies the request and should be included in support tickets for faster debugging.

## Error Types

The API uses four error types that map to HTTP status code ranges:

`invalid_request_error` (400) indicates a problem with the request itself. This includes missing required fields, invalid field values, malformed JSON bodies, and unsupported query parameters. Fix the request and retry.

`authentication_error` (401) indicates that the provided credentials are missing, invalid, or expired. Check your API key or access token and ensure it has not been revoked. If using OAuth, the access token may need to be refreshed using the refresh token.

`permission_error` (403) indicates that the credentials are valid but do not have sufficient permissions for the requested operation. This can happen when an API key is IP-restricted and used from an unauthorized address, when an OAuth token lacks the required scope, or when a non-admin user attempts an admin-only operation.

`not_found_error` (404) indicates that the requested resource does not exist or has been deleted. Verify the resource ID and ensure you are using the correct environment (sandbox versus production).

`rate_limit_error` (429) indicates that you have exceeded your rate limit. Wait for the duration specified in the `Retry-After` header before retrying. See the Rate Limiting guide for details on limits and best practices.

`api_error` (500, 502, 503) indicates an internal platform error. These are rare and typically transient. Retry the request with exponential backoff. If the error persists for more than 5 minutes, check the status page at status.acme.io or contact support.

## Common Error Codes

Here are the most frequently encountered error codes and how to resolve them:

`parameter_missing` means a required field was not included in the request body. Check the API reference for the endpoint you are calling and ensure all required fields are present.

`parameter_invalid` means a field value is not in the expected format. Common causes include non-numeric values for amount fields, invalid email formats, unsupported currency codes, and enum values that do not match the allowed set.

`resource_not_found` means the ID you specified does not match any existing resource. Double-check the ID and ensure you are querying the correct environment.

`idempotency_key_in_use` means you sent a request with an idempotency key that was already used for a different request body. Each idempotency key must be paired with a unique request. Generate a new key if you need to retry with different parameters.

`token_expired` means your OAuth access token has expired. Use your refresh token to obtain a new access token. If the refresh token is also expired, the user must re-authorize your application.

`insufficient_permissions` means the API key or OAuth token does not have the required scope for this operation. Request additional scopes during the OAuth flow or create a new API key with broader permissions.

`payment_method_declined` means the customer's payment method was declined by the issuing bank. Ask the customer to use a different payment method or contact their bank.

`duplicate_resource` means you attempted to create a resource that already exists. For example, inviting a user with an email address that is already registered. Use the existing resource or delete it first if you need to recreate it.

## Idempotency

For POST requests that create resources, you can include an `Idempotency-Key` header to ensure the operation is performed at most once. If you send the same request with the same idempotency key within 24 hours, the API returns the original response instead of creating a duplicate resource.

```
POST /v1/payments
Content-Type: application/json
Idempotency-Key: unique-key-12345

{
  "amount": 5000,
  "currency": "usd",
  "payment_method": "pm_card_visa"
}
```

Idempotency keys must be unique strings up to 255 characters. UUIDs are recommended. The key is scoped to your API key, so different applications can use the same key value without conflict. After 24 hours, the key expires and can be reused for a new request.

Idempotency is especially important for payment operations. Network errors or timeouts can leave you unsure whether a payment was created. By including an idempotency key, you can safely retry the request without risking a double charge.

## Debugging with Request IDs

Every API response includes a `request_id` in the response body and in the `X-Request-Id` response header. This ID is unique to the request and links to detailed server-side logs including the full request and response payloads, processing time, and any internal errors.

When contacting support about an API error, always include the request ID. Support engineers can look up the request in less than a minute using the ID, compared to searching by timestamp and parameters which takes significantly longer. Log request IDs alongside your application logs to correlate API calls with your own processing pipeline.

The request ID is also included in webhook delivery payloads, linking the event back to the API call that triggered it. For example, a `payment.completed` event includes the request ID of the original payment creation call.
