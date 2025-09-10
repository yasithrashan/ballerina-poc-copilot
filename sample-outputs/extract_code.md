# Code Extract Report

**Search criteria:** The code segments related to the existing get orders and get products endpoints, which need to be updated with pagination support (limit, offset, and sortBy parameters).
**Files processed:** 2
**Generated:** 2025-09-01T17:45:07.153Z

---

### File: main.bal

```
resource function get products() returns Product[]|error {
    sql:ParameterizedQuery selectQuery = `
        SELECT product_id, name, description, price, currency, active, stripe_product_id, stripe_price_id, created_at
        FROM products WHERE active = true
    `;

    stream<Product, sql:Error?> productStream = dbClient->query(selectQuery);
    Product[] products = [];

    check from Product product in productStream
        do {
            products.push(product);
        };

    return products;
}
```

```
resource function get orders() returns OrderSummary[]|error {
    sql:ParameterizedQuery summaryQuery = `
        SELECT o.order_id, o.customer_id, c.name as customer_name, o.status,
               o.total_amount, o.currency, o.created_at,
               COUNT(oi.order_item_id) as item_count
        FROM orders o
        JOIN customers c ON o.customer_id = c.customer_id
        LEFT JOIN order_items oi ON o.order_id = oi.order_id
        GROUP BY o.order_id, o.customer_id, c.name, o.status, o.total_amount, o.currency, o.created_at
        ORDER BY o.created_at DESC
    `;

    stream<record {|int order_id; int customer_id; string customer_name; string status;
                   decimal total_amount; string currency; int created_at; int item_count;|}, sql:Error?> summaryStream = dbClient->query(summaryQuery);

    OrderSummary[] summaries = [];

    check from var summary in summaryStream
        do {
            time:Utc createdTime = [summary.created_at, 0];
            OrderSummary orderSummary = {
                orderId: summary.order_id,
                customerId: summary.customer_id,
                customerName: summary.customer_name,
                status: summary.status,
                totalAmount: summary.total_amount,
                currency: summary.currency,
                itemCount: summary.item_count,
                createdAt: createdTime
            };
            summaries.push(orderSummary);
        };

    return summaries;
}
```

### File: types.bal

```
public type Product record {|
    int productId?;
    string name;
    string description;
    decimal price;
    string currency;
    boolean active;
    string? stripeProductId;
    string? stripePriceId;
    time:Utc createdAt?;
|};

public type OrderSummary record {|
    int orderId;
    int customerId;
    string customerName;
    string status;
    decimal totalAmount;
    string currency;
    int itemCount;
    time:Utc createdAt;
|};
```
