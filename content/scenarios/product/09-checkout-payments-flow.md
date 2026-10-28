---
title: "Build a reliable checkout and payment flow: idempotency, webhooks and failure states"
level: advanced
type: scenario
tags: [checkout, payments, stripe, idempotency, webhooks, double-submit, server-actions, security]
related: [backend/transactions-acid, machine-coding/form-wizard, browser-security/csrf-samesite]
---

## Question
Design the checkout flow for an online store using a payment provider such as Stripe. Users sometimes double-click Pay, lose connection mid-payment, close the tab after being charged, or hit 3-D Secure challenges. How do you make it correct and trustworthy?

## Clues
- The browser is not a reliable witness: the provider's webhook is the source of truth for payment status.
- Every step that can be retried must be idempotent.
- Never handle raw card data yourself.

## Interview Answer
I'd keep card data entirely with the provider (Stripe Elements / Payment Element / hosted Checkout) so my servers never touch PANs, which shrinks PCI scope. The server creates an **order** in a `pending` state with a server-calculated total (never trusting prices from the client) and a **PaymentIntent** using an idempotency key tied to the order; the client confirms the payment with the provider SDK, which handles SCA/3-D Secure redirects. The browser result is only a hint: the authoritative state change (`pending → paid`, inventory commit, receipt email, fulfilment) happens in a **webhook handler** that verifies the signature, is idempotent (deduplicate by event id; use a unique constraint), and processes in a transaction. The UI disables the Pay button while submitting, shows a clear "processing" state, and after returning from a redirect or reconnecting it polls the order status (or subscribes to updates) until the webhook has moved it to a final state. I handle failure modes explicitly (declined, requires action, timeout, abandoned, partial inventory) with reconciliation jobs for stuck orders, structured logs and alerts, and test with the provider's test cards and webhook replay.

## Explanation
### Flow
```txt
1 Client: POST /api/checkout  {cartId}
2 Server: recompute totals from DB prices/discounts/tax; reserve stock (short TTL);
          create Order(status=pending); create PaymentIntent(amount, currency, metadata.orderId,
          idempotencyKey = `order-${orderId}`); return clientSecret
3 Client: stripe.confirmPayment({ elements, confirmParams:{ return_url } })   // handles 3DS
4 Provider → Server webhook: payment_intent.succeeded | payment_failed
5 Server (webhook): verify signature → dedupe event id → tx: order.paid, commit stock, enqueue receipt/fulfilment
6 Client: return_url page polls GET /api/orders/:id until status is final (paid/failed), then shows the result
```

### Server rules
- **Price integrity**: compute amounts server-side from catalogue data; the client sends only ids and quantities.
- **Idempotency keys** on create-order and provider calls so retries don't create duplicates. A double-clicked Pay returns the same intent.
- **Stock reservation** with expiry; release on failure/timeout.
- **State machine**: `pending → processing → paid | failed | cancelled | expired` with allowed transitions enforced and logged.
- **Webhook handler**:
  - Verify the signature using the raw request body (in Next.js Route Handlers read `await req.text()` before parsing).
  - Respond 2xx quickly; do heavy work asynchronously; provider retries on non-2xx with backoff.
  - Idempotent: store processed event ids; handle out-of-order events by checking current state.
- **Reconciliation job**: periodically list recent provider payments and compare to orders to repair missed webhooks.
- **Refunds/disputes** flow through the same event-driven pipeline.

### Client rules
```tsx
const [state, setState] = useState<"idle" | "submitting" | "processing" | "error">("idle");

async function pay() {
  if (state !== "idle") return;                      // prevent double submit
  setState("submitting");
  const { error } = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${origin}/orders/${orderId}/status` } });
  if (error) { setState("error"); showMessage(error.message); }   // card errors; success redirects away or resolves
  else setState("processing");
}
```
- Disable the button and show progress; keep the form data on error so the user can retry or change method.
- Don't treat the SDK's resolved promise as "paid"; show "Confirming your payment…" and poll order status with a timeout and a "contact support/check later" message.
- Support refresh and back-button: order status page is derived from the server, not component state.
- Persist cart and order id so a closed tab can recover.
- Accessible error messages (`role="alert"`), field-level validation, autofill attributes (`autocomplete="cc-number"` is handled by the provider's elements).

### Failure matrix

| Situation | Handling |
|---|---|
| Double click / retry | idempotency key returns same order/intent |
| Card declined | provider error shown; order stays pending; allow another method |
| 3-D Secure required | SDK handles; return_url finishes; webhook confirms |
| Network drop after confirm | user returns; status page polls server truth |
| Webhook delayed/missed | polling + reconciliation job |
| Price changed during checkout | server recomputes at order creation; show updated total before confirm |
| Stock sold out | fail before charge (reserve first) or refund automatically |
| Abandoned checkout | expiry job cancels the intent and releases stock |
| Fraud signals | provider radar rules, velocity limits, manual review |

### Security and compliance
- Use the provider's hosted fields/pages (PCI SAQ A scope); never log card data or full request bodies.
- Authenticate the user for saved methods; protect endpoints with CSRF/Origin checks and rate limits.
- Webhook secrets in server env only; verify signatures; restrict by IP only as additional defence.
- Server Actions or Route Handlers must authorise the cart and order ownership (IDOR prevention).
- Handle taxes and currency with integer minor units (paise/cents), never floats.
- Keep audit logs of state changes.

### Testing
Provider test cards (success, decline, 3DS), the CLI to replay webhooks, e2e tests for double-click and refresh scenarios, contract tests for the webhook handler (duplicate and out-of-order events), and chaos tests for dropped connections.

## Follow-ups
- **Why not mark the order paid when the client says success?** — A client can lie or disconnect; the provider's signed webhook is the trusted signal.
- **Hosted Checkout vs Elements?** — Hosted Checkout is fastest and lowest risk; Elements gives more UI control with slightly more integration work.

## Common Mistakes
- Computing prices on the client.
- Fulfilling orders from the redirect page instead of the webhook.
- Non-idempotent webhook handling causing double fulfilment.

## Tips
- Say "server truth via webhook, idempotency everywhere, UI reflects order status".
