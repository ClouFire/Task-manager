<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## API authentication

Every endpoint, including `GET /`, requires `Authorization: Bearer <key>`.
Missing, invalid, expired, or revoked keys return HTTP 401. Authentication uses
Nest's [API-key provider](https://docs.nestjs.com/security/authentication#issue-api-keys-to-partners).

Set `MASTER_API_KEY` in [.env](.env), or in the process environment (which takes
precedence). A random master key was generated locally during setup; it is ignored
by Git and is never stored in PostgreSQL. On another installation, copy
[.env.example](.env.example) to `.env` and generate a key with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Startup requires at least 32 non-whitespace characters. Restart the API after
changing its master key.

Only the master can manage database keys:

- `POST /auth/api-keys` — body `{"name":"Warehouse","expiresAt":"2027-01-01T00:00:00Z"}`; expiry is optional and must be in the future. Returns the secret `key` once.
- `GET /auth/api-keys` — lists metadata, never secrets or hashes.
- `DELETE /auth/api-keys/:id` — revokes the key, retaining its record.

Database keys work on all business endpoints. Their SHA-256 hashes, names,
creation dates, expiration dates, and revocation dates are stored in `api_keys`.
Revocation and expiry apply on the next request; database keys cannot manage keys.
The master authenticates directly from configuration without a key lookup.

```bash
# Load your local master into this shell.
set -a
. ./.env
set +a

curl http://localhost:3001/auth/api-keys \
  -H "Authorization: Bearer $MASTER_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Warehouse"}'

# Copy the returned key into API_KEY, then use it on business requests.
API_KEY='nest_<id>_<secret>'
curl http://localhost:3001/orders -H "Authorization: Bearer $API_KEY"
```

Add the same Authorization header to the API examples below and in the Docker guide.

## Invoices, payments, credit notes, and refunds

All billing endpoints require Bearer authentication. Every financial `POST` also
requires `Idempotency-Key` (1–100 letters, digits, dots, underscores, colons, or
hyphens). Generate a new key for each intended operation; reuse it with the same
body when retrying. A retry returns the existing document, while a changed body
returns HTTP 409. Keys are scoped to the document type and invoice; invoice
creation is additionally limited to one invoice per order.

| Resource | Create | Read |
| --- | --- | --- |
| Invoices (`SI-1`) | `POST /invoices` | `GET /invoices`, `GET /invoices/:id` |
| Payments (`PAY-1`) | `POST /payments` | `GET /payments`, `GET /payments/:id` |
| Credit notes (`CN-1`) | `POST /credit-notes` | `GET /credit-notes`, `GET /credit-notes/:id` |
| Refunds (`RF-1`) | `POST /refunds` | `GET /refunds`, `GET /refunds/:id` |

Documents are posted immediately, retained permanently through this API, and
have a `journalId` linking to the associated `AC-` accounting entry. There are no
edit or delete endpoints. Invoices snapshot customer details, product details,
quantities, prices, and rounded line tax amounts from the order. Only a positive
order total can be invoiced, and cancelled orders cannot receive a new invoice.
The optional `dueDate` is an ISO timestamp. This version invoices the complete
order once; it does not implement drafts or partial invoices.

### Currency and tax treatment

Set `ACCOUNTING_CURRENCY` before issuing invoices (default `USD`, for example
`GEL` or `EUR`). The ledger uses one currency, with two decimal places for money.
Payments and refunds inherit the invoice currency. Creating another invoice in
a different configured currency is rejected; exchange rates and multiple
currencies are not implemented.

Set `BILLING_TAX_TREATMENT` according to what your existing item percentage means:

- `markup` (default): your previously described purchase-tax recovery is included
  in sales revenue. The invoice still shows the separately calculated percentage.
- `sales_tax`: the percentage represents tax collected from the customer and is
  posted to `TAX_PAYABLE` separately from sales revenue.

Each invoice records its tax account, so later credit notes reverse the original
treatment even if configuration changes. This is a choice of posting behavior;
regional tax rules, invoice compliance, and input-tax recovery are not implemented.

### Example financial flow

Use an existing order UUID for `ORDER_ID`. Load the master key from your local
environment or use a database API key. Amounts are decimal strings in major units.
The examples use `jq` to extract returned UUIDs and totals.

```bash
API_URL=http://localhost:3001
API_KEY="$MASTER_API_KEY"
ORDER_ID='<order UUID>'

# Invoice the complete order; retain this request key if retrying.
INVOICE_REQUEST_KEY=$(node -e 'console.log(require("node:crypto").randomUUID())')
INVOICE=$(curl --fail-with-body -sS "$API_URL/invoices" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $INVOICE_REQUEST_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"orderId\":\"$ORDER_ID\"}")
INVOICE_ID=$(printf '%s' "$INVOICE" | jq -r .id)
TOTAL=$(printf '%s' "$INVOICE" | jq -r .total)
LINE_ID=$(printf '%s' "$INVOICE" | jq -r '.lines[0].orderLineId')
LINE_QUANTITY=$(printf '%s' "$INVOICE" | jq -r '.lines[0].quantity')

# Record an already completed payment. This does not charge a card or bank account.
PAYMENT_REQUEST_KEY=$(node -e 'console.log(require("node:crypto").randomUUID())')
PAYMENT=$(curl --fail-with-body -sS "$API_URL/payments" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $PAYMENT_REQUEST_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"invoiceId\":\"$INVOICE_ID\",\"amount\":\"$TOTAL\",\"method\":\"bank_transfer\",\"reference\":\"bank-$PAYMENT_REQUEST_KEY\"}")
PAYMENT_ID=$(printf '%s' "$PAYMENT" | jq -r .id)

# Credit the first invoice line using its original price and rounded tax.
CREDIT_REQUEST_KEY=$(node -e 'console.log(require("node:crypto").randomUUID())')
CREDIT=$(curl --fail-with-body -sS "$API_URL/credit-notes" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $CREDIT_REQUEST_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"invoiceId\":\"$INVOICE_ID\",\"reason\":\"Customer return\",\"lines\":[{\"orderLineId\":\"$LINE_ID\",\"quantity\":$LINE_QUANTITY}]}")
CREDIT_ID=$(printf '%s' "$CREDIT" | jq -r .id)
CREDIT_TOTAL=$(printf '%s' "$CREDIT" | jq -r .total)

# Record the money actually returned against the payment and credit note.
REFUND_REQUEST_KEY=$(node -e 'console.log(require("node:crypto").randomUUID())')
curl --fail-with-body -sS "$API_URL/refunds" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: $REFUND_REQUEST_KEY" \
  -H 'Content-Type: application/json' \
  -d "{\"invoiceId\":\"$INVOICE_ID\",\"paymentId\":\"$PAYMENT_ID\",\"creditNoteId\":\"$CREDIT_ID\",\"amount\":\"$CREDIT_TOTAL\",\"reference\":\"refund-$REFUND_REQUEST_KEY\"}"

curl --fail-with-body -sS "$API_URL/invoices/$INVOICE_ID" \
  -H "Authorization: Bearer $API_KEY"
```

Payments may be partial, must be positive, and cannot exceed the invoice amount
due. Methods are `cash`, `bank_transfer`, `card`, and `other`; each method/reference
pair identifies one payment globally. Refund references are also globally unique.
The current implementation records completed movements into the single `CASH`
control account; gateway processing, bank reconciliation, and pending transactions
are separate future features.

Credit notes accept one or more original `orderLineId`/quantity pairs and a reason.
Combined credited quantities cannot exceed the invoice quantities. Partial-credit
tax allocation preserves the original rounded tax exactly over a full reversal.
Credits reduce an unpaid debt first. Refunds require available customer credit and
cannot exceed the remaining amount of either the linked payment or credit note.

`GET /invoices/:id` reports `paid`, `credited`, `refunded`, `netTotal`, `netPaid`,
`amountDue`, `refundableAmount`, and `paymentStatus`. The order payment status is
updated transactionally from the same records: `unpaid`, `partially_paid`, `paid`,
or `refunded`. A fully credited invoice with no payment remains `unpaid` with zero
due; inspect `credited` and `netTotal` to distinguish it from an unpaid sale.

**Behavior change:** `PATCH /orders/:id/payment-status` now returns HTTP 409 for
valid statuses; use billing records instead. New orders accept only `unpaid` as an
optional initial payment status. Previously manually assigned payment statuses
are not converted into fictitious payments; reconcile them when creating the
first invoice for an existing order.

Inventory returns/resends/cancellations do not automatically issue financial
credits or refunds. Use the existing order status workflow to restore inventory,
and issue financial documents separately when the sale is actually reversed.
Each billing mutation locks its order and commits its document, balanced journal,
and payment status in a single transaction. Rejected or failed postings leave no
partial document or ledger entries.

| Document | Debit | Credit |
| --- | --- | --- |
| Invoice | Receivable | Sales (and tax payable in `sales_tax` mode) |
| Payment | Cash | Receivable |
| Credit note | Original sales/tax accounts | Receivable |
| Refund | Receivable | Cash |

Direct manual journal postings to `RECEIVABLE` and `TAX_PAYABLE` are rejected to
keep their balances aligned with billing records. Stock cost entries remain
managed by the inventory workflow.

## Compile and run the project

For separate local production and staging PostgreSQL containers, run `npm run db:up`.
Use `npm run start:stage` (API port 3001) or `npm run start:production:local`
(API port 3000). `npm run start:local` defaults to staging.
Run `npm run test:e2e:local` to test all API endpoints against the test database
in the staging container. See [the Docker guide](docker/README.md) for details.

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project, run this and approve the code it prints at [observe.nestjs.com/link](https://observe.nestjs.com/link) - signing up for free if you have no account:

```bash
$ npx @nestjs/observe link
```

It installs `@nestjs/observe`, wires it into `AppModule` and `main.ts`, and writes the app key and secret into `.env`, which every `nest start` script (`start`, `start:dev`, `start:debug`) then loads. In production, set `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` in the environment instead.

Or do it by hand:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/sdk) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## ERP API with PostgreSQL

The ERP follows the existing Nest CLI module/controller/service/DTO structure:
[`inventory`](src/inventory/inventory.module.ts) handles stock and
[`accounting`](src/accounting/accounting.module.ts) handles the ledger.
Inventory, accounting and profiles use TypeORM repositories and PostgreSQL.
Set `DATABASE_URL` before starting the app, for example:

```bash
export DATABASE_URL=postgres://postgres:password@localhost:5432/nest
npm run start:dev
```

The database must already exist. The current development configuration uses
`synchronize: true`; use migrations and disable synchronization for production.
Data persists across restarts. Startup inserts the ten `ITEM-001`–`ITEM-010`
items, default accounts and sample profiles when their keys are absent, without
replacing existing rows or resetting balances.

Stock movements lock the item row and commit stock, journal lines and movement
in one database transaction. Journal posting uses a PostgreSQL transaction-scoped
advisory lock to serialize cumulative monetary limit checks across instances.
Bulk item creation is transactional and the unique SKU index rejects duplicates.
PostgreSQL bigint fields stay strings inside entities; API responses retain safe
integer numbers and ISO timestamps.

### Endpoints

Business records expose a permanent, server-generated `tranid` for display:

| Record                               | Display ID |
| ------------------------------------ | ---------- |
| Profile                              | `UP-1`     |
| Sales order                          | `SO-1`     |
| Inventory item                       | `II-1`     |
| Accounting operation (journal entry) | `AC-1`     |

UUID `id` fields remain the API/resource identifiers and foreign keys. The
number in `tranid` comes from a separate PostgreSQL sequence per record type;
it is not a conversion of the UUID. The prefix is fixed for that type.
Numbers start at 1 in a new database, are unique within each type, and may
have gaps after rollbacks, deletions, or repeated seed attempts. Existing
records receive display IDs when the app next synchronizes the schema.
Later updates, packing, return, cancellation, and restarts do not change them.

`tranid` appears in create/list/detail responses. Inventory movements expose
their linked journal's `AC-` reference so a stock operation and its accounting
entry have the same display reference. Chart accounts retain their existing
codes, and line records belong to their parent order or journal. The numeric
sequence backing a display ID is hidden from API responses. Clients cannot
assign the generated `tranid`; continue using UUIDs in endpoint paths.

| Method | Path                       | Purpose                                            |
| ------ | -------------------------- | -------------------------------------------------- |
| POST   | `/inventory/items`         | Create one item object or an array of 1–1000 items |
| GET    | `/inventory/items`         | List inventory items                               |
| GET    | `/inventory/items/:id`     | Find an item by UUID                               |
| POST   | `/inventory/movements`     | Receive or issue stock and post its journal        |
| GET    | `/inventory/movements`     | List movements with linked journal IDs             |
| GET    | `/inventory/balance`       | Quantities, item values and total stock value      |
| GET    | `/accounting/accounts`     | List the chart of accounts                         |
| POST   | `/accounting/accounts`     | Create an account with a unique code               |
| POST   | `/accounting/journals`     | Post a balanced double-entry journal               |
| GET    | `/accounting/journals`     | List journals                                      |
| GET    | `/accounting/journals/:id` | Retrieve a journal by UUID                         |
| GET    | `/accounting/balance`      | Trial balance with debit and credit totals         |

### Inventory pipeline

Send JSON to `POST /inventory/items`:

```json
{ "sku": "PART-001", "name": "Replacement part" }
```

The same endpoint accepts bulk creation:

```json
[
  { "sku": "PART-002", "name": "Bracket" },
  { "sku": "PART-003", "name": "Bolt" }
]
```

A single object returns an item; an array returns an array. Items start with zero
quantity and value. SKUs are case insensitive and stored uppercase. The entire
batch is validated before insertion; duplicates return 409 without creating any
items. Invalid input returns 400 and missing resources return 404.

Use the returned item UUID to receive stock at `POST /inventory/movements`:

```json
{
  "itemId": "<returned item UUID>",
  "type": "receipt",
  "quantity": 10,
  "unitCost": "12.50",
  "description": "Supplier delivery"
}
```

This adds 10 units valued at "125.00", debits `INVENTORY` and credits `PAYABLE`.
Set `counterAccountCode` to `CASH` for an immediately paid purchase or `EQUITY`
for opening stock. An unknown counter account rejects the entire movement.

Issue stock using the same movement endpoint:

```json
{
  "itemId": "<returned item UUID>",
  "type": "issue",
  "quantity": 3,
  "description": "Goods dispatched"
}
```

This removes stock, debits `COGS` and credits `INVENTORY`. Issues use the current
weighted-average stock cost, rounded half-up to two decimal places; issuing
all remaining units consumes the exact remaining value. Do not send `unitCost`
for issues. Negative stock and zero-value movements are rejected. Stock and the
linked journal are committed together only after validation succeeds.

### Accounting pipeline

Default accounts: `INVENTORY`, `CASH`, `PAYABLE`, `COGS`, `EQUITY`, `SALES`.
Custom accounts accept `code`, `name` and a `type` of `asset`, `liability`,
`equity`, `income` or `expense`.

All monetary request/response fields use decimal strings in major currency units,
for example `"12.50"`, including zero as `"0.00"`. JSON numbers, exponent notation,
negative input amounts, and more than two decimal places are rejected.
PostgreSQL stores money as `numeric(20,2)`; `decimal.js` performs arithmetic with
explicit half-up rounding. Quantities remain positive safe integer numbers.
Amounts and accumulated ledger totals must fit `numeric(20,2)`.

On startup, a transactional migration runs before schema synchronization and
converts existing bigint money columns from minor units, so an old stored
`1500` becomes `"15.00"`. Quantities and reservation counts are unchanged.
The migration is recorded and checks column types to avoid converting twice.
Existing order prices remain unchanged in monetary value, with zero tax by
default. New API clients must send decimal strings after upgrading.

Post a supplier payment to `POST /accounting/journals`:

```json
{
  "description": "Pay supplier",
  "lines": [
    { "accountCode": "PAYABLE", "debit": "125.00", "credit": "0.00" },
    { "accountCode": "CASH", "debit": "0.00", "credit": "125.00" }
  ]
}
```

Each journal requires at least two lines, exactly one positive debit or credit
per line, existing accounts, and equal total debits and credits. Journals are
append-only; corrections use compensating entries. Direct journal postings to
`INVENTORY` are blocked to keep the stock valuation and control account aligned.
The trial balance reports `balance = debit - credit` for every account, so credit
balances (including liabilities and income) appear negative.

For a sale, pack the order to record inventory cost, issue an invoice to book
revenue and receivables, and record completed payments through the billing API.
All endpoints require Bearer authentication. Tax filing, supplier bills,
purchasing approval workflows, multiple currencies, and warehouses are not
implemented.

### Orders

The orders module was scaffolded with `npx @nestjs/cli` and uses the same
PostgreSQL connection as inventory, accounting, and profiles.

| Method | Endpoint                     | Behavior                                           |
| ------ | ---------------------------- | -------------------------------------------------- |
| POST   | `/orders`                    | Create an order without reserving or issuing stock |
| GET    | `/orders`                    | List orders and their items                        |
| GET    | `/orders/:id`                | Read one order                                     |
| PATCH  | `/orders/:id/status`         | Transition its inventory lifecycle                 |
| PATCH  | `/orders/:id/payment-status` | Returns 409; status is derived from billing records |

Create an order with existing profile and inventory item IDs:

```json
{
  "profileId": "b1838910-1b31-4c6b-9431-1277a1041001",
  "deliveryType": "shipping",
  "deliveryAddress": "10 Main Street",
  "deliveryDate": "2026-12-05T12:00:00Z",
  "productionDate": "2026-12-01T09:00:00Z",
  "paymentStatus": "unpaid",
  "items": [
    { "itemId": "<existing item UUID>", "quantity": 3, "unitPrice": "15.00" },
    { "itemId": "<another item UUID>", "quantity": 2, "unitPrice": "25.00" }
  ]
}
```

An order requires a profile, a delivery type (`shipping` or `local`), and
1–100 distinct item lines. Shipping requires a nonblank address. Delivery and
production dates are optional ISO 8601 values. `createdAt` is assigned by the
server. Quantities are positive safe integers; unit prices are nonnegative
decimal strings in major currency units. `totalPrice` includes the taxes
calculated separately for each item line. Clients cannot override totals,
reservations, creation time, initial status, or an order line's tax rate. `totalCost` is `null` until packing, when actual inventory issue costs
are recorded on each line and totaled on the order.

Each inventory item has a `taxRate` percentage, defaulting to zero. Set it
when creating the item, for example:

```json
{ "sku": "TAXED-PART", "name": "Taxed part", "taxRate": "20" }
```

For an existing item, send `{"taxRate":"7.5"}` to
`PATCH /inventory/items/:id/tax-rate`. A receipt can also include `taxRate`
alongside `unitCost`; the new rate is saved only if the entire receipt succeeds.
Rates range from 0 to 100 percent with up to four decimal places. Rates may be
JSON strings or numbers; monetary amounts must be strings.

At order creation, each item's current rate is copied onto the order line.
Later item-rate changes affect future orders, while existing orders keep their
quoted rates and prices through fulfillment, packing, return, and resend.
For each item line:

```text
subtotal   = quantity × unitPrice
taxAmount  = round_half_up(subtotal × taxRate / 100, 2)
totalPrice = subtotal + taxAmount
```

The order exposes `subtotal`, `totalTax` (the sum of rounded line taxes), and
`totalPrice`. Each item exposes `unitPrice`, `taxRate`, `subtotal`, `taxAmount`,
and `totalPrice`. For example, two units at `"10.25"` with 20% tax have subtotal
`"20.50"`, tax `"4.10"`, and total `"24.60"`. A different item may use a different
rate. Zero-rated items add no tax. Inventory purchase costs remain the entered
acquisition costs; the configured percentage is applied to the order selling
price. Order creation does not post a sales journal. Issuing an invoice posts
revenue and receivables, using the configured tax treatment described above.

Send `{"status":"fulfilled"}` to the status endpoint to reserve all lines.
Physical quantities and inventory values remain unchanged. Insufficient
available stock returns 409 and reserves nothing, including on other lines.
Inventory responses expose `quantity`, `reservedQuantity`, and
`availableQuantity`; ordinary stock issues can consume only available units.
Receipts remain allowed while stock is reserved.

Send `{"status":"packed"}` to deduct the order's reserved units. Packing uses
the current weighted-average cost, creates ordinary issue movements and their
COGS/inventory journals, and stores each movement ID on its order line.
The status, reservations, inventory, movement records, and ledger changes all
commit in one transaction. Packing does not automatically book sales revenue.

The lifecycle is `created → fulfilled → packed → returned`. Created, fulfilled,
or returned orders can transition to `cancelled`. Cancellation only changes
the status and releases reservations: the order and all its item lines remain
in the database and available through the list/detail endpoints. Cancelled
orders are terminal. A packed order must be returned before cancellation.

Send `{"status":"returned"}` to `PATCH /orders/:id/status` after packing to
disassemble the order into its original item lines. Every component quantity
returns to inventory and is immediately reserved for the same order; other
orders and manual issues cannot consume it. The current model treats the
order's item lines as its components, with no separate product recipe.
Each return restores the exact original issue value (including rounding),
debits `INVENTORY`, and credits the original issue's counter account (`COGS`
for orders). This reverses the outstanding issue cost: the order and line
`totalCost` become zero. Prices, profile, dates, and payment status stay intact.
Returns do not automatically refund payments or reverse sales revenue.

From `returned`, send `{"status":"packed"}` to resend the unchanged order,
deducting its committed stock at the current weighted-average cost, or send
`{"status":"cancelled"}` to release the reservation and keep the returned
components in stock. An order can go through multiple pack/return cycles.
Each cycle appends movements and journals. `movementId` identifies the latest
outbound movement on each line; inventory movements of type `return` link to
their original issue through `reversedMovementId`, preserving earlier cycles.
Return movements can only be created by the order workflow, not by the public
receipt/issue endpoint. All components, reservations, and journals commit in
one transaction, so a failed return changes nothing.

Repeating the current status is safe and does not reserve, issue, or return
again. Item lines are immutable after creation. Concurrent reservations and
stock issues use database row locks; committed stock cannot be promised to
another order.

Payment status is derived from invoices, payments, credits, and refunds. Use the
billing endpoints described above; manually changing an order payment status is
rejected with HTTP 409. Financial documents do not alter inventory.

Run `npm run test:e2e:local` for the PostgreSQL API tests, including order
creation, reservations, competing orders, duplicate packing and returns,
resending, cancellation without deletion, exact return valuation, item taxes,
decimal migration, costing, validation, and transaction rollback.

ERP HTTP integration coverage lives in [`test/erp.e2e-spec.ts`](test/erp.e2e-spec.ts).
Run `npm run build`, `npm test -- --runInBand` and
`TEST_DATABASE_URL=postgres://postgres:password@localhost:5432/nest_test npm run test:e2e -- --runInBand`
to verify the implementation. Use a dedicated test database. Each HTTP test
creates its own temporary schema and removes it afterward; the tests never use
`DATABASE_URL`. Coverage includes concurrent stock issues, rollback after a
movement insert failure, persistent data across connections, and profile CRUD.
