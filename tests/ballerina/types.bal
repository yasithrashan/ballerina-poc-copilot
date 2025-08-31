import ballerina/time;

// Order Management Types
public type OrderStatus "PENDING"|"CONFIRMED"|"PROCESSING"|"SHIPPED"|"DELIVERED"|"CANCELLED";

public type PaymentStatus "PENDING"|"PAID"|"FAILED"|"REFUNDED";

public type OrderItem record {|
    string productId;
    string productName;
    int quantity;
    decimal unitPrice;
    decimal totalPrice;
|};

public type Order record {|
    string orderId;
    string customerId;
    OrderItem[] items;
    decimal totalAmount;
    OrderStatus status;
    PaymentStatus paymentStatus;
    string? stripeInvoiceId;
    string? stripeSubscriptionId;
    time:Utc createdAt;
    time:Utc? updatedAt;
    string? shippingAddress;
    string? notes;
|};

public type Customer record {|
    string customerId;
    string name;
    string email;
    string? phone;
    string? address;
    string? stripeCustomerId;
    time:Utc createdAt;
|};

public type Product record {|
    string productId;
    string name;
    string description;
    decimal price;
    string? stripePriceId;
    string? stripeProductId;
    boolean active;
    int stockQuantity;
|};

public type OrderRequest record {|
    string customerId;
    OrderItem[] items;
    string? shippingAddress;
    string? notes;
    boolean isSubscription?;
|};

public type CustomerRequest record {|
    string name;
    string email;
    string? phone;
    string? address;
|};

public type ProductRequest record {|
    string name;
    string description;
    decimal price;
    int stockQuantity;
    boolean active?;
|};

public type OrderResponse record {|
    string orderId;
    string message;
    OrderStatus status;
    decimal totalAmount;
|};

public type ErrorResponse record {|
    string message;
    string errorCode;
|};

// Data storage types
public type OrderData record {|
    Order[] orders;
|};

public type CustomerData record {|
    Customer[] customers;
|};

public type ProductData record {|
    Product[] products;
|};