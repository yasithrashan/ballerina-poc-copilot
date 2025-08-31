import ballerina/time;

// Order status enumeration
public enum OrderStatus {
    PENDING = "pending",
    CONFIRMED = "confirmed",
    PROCESSING = "processing",
    SHIPPED = "shipped",
    DELIVERED = "delivered",
    CANCELLED = "cancelled"
}

// Payment status enumeration
public enum PaymentStatus {
    PENDING = "pending",
    PAID = "paid",
    FAILED = "failed",
    REFUNDED = "refunded"
}

// Customer record
public type Customer record {|
    string customerId;
    string firstName;
    string lastName;
    string email;
    string phone;
    Address address;
    time:Utc createdAt;
    boolean isActive;
|};

// Address record
public type Address record {|
    string street;
    string city;
    string state;
    string zipCode;
    string country;
|};

// Product record
public type Product record {|
    string productId;
    string name;
    string description;
    string category;
    decimal price;
    int stockQuantity;
    decimal weight;
    string[] tags;
    boolean isActive;
    time:Utc createdAt;
    time:Utc updatedAt;
|};

// Order item record
public type OrderItem record {|
    string productId;
    string productName;
    int quantity;
    decimal unitPrice;
    decimal totalPrice;
    decimal weight;
|};

// Order record
public type Order record {|
    string orderId;
    string customerId;
    OrderItem[] items;
    decimal subtotal;
    decimal taxAmount;
    decimal discountAmount;
    decimal shippingCost;
    decimal totalAmount;
    OrderStatus status;
    PaymentStatus paymentStatus;
    Address shippingAddress;
    Address? billingAddress;
    string? notes;
    time:Utc createdAt;
    time:Utc updatedAt;
    time:Utc? shippedAt;
    time:Utc? deliveredAt;
    string? trackingNumber;
|};

// Order creation request
public type CreateOrderRequest record {|
    string customerId;
    OrderItemRequest[] items;
    Address shippingAddress;
    Address? billingAddress;
    string? notes;
    decimal? discountAmount;
|};

// Order item request
public type OrderItemRequest record {|
    string productId;
    int quantity;
|};

// Order update request
public type UpdateOrderRequest record {|
    OrderStatus? status;
    PaymentStatus? paymentStatus;
    string? trackingNumber;
    string? notes;
|};

// Response types
public type OrderResponse record {|
    boolean success;
    string message;
    Order? data;
|};

public type OrderListResponse record {|
    boolean success;
    string message;
    Order[]? data;
    int totalCount;
|};

public type CustomerResponse record {|
    boolean success;
    string message;
    Customer? data;
|};

public type ProductResponse record {|
    boolean success;
    string message;
    Product? data;
|};

public type ProductListResponse record {|
    boolean success;
    string message;
    Product[]? data;
    int totalCount;
|};

// Error response
public type ErrorResponse record {|
    boolean success;
    string message;
    string? errorCode;
|};

// Database storage types
public type OrderDatabase record {|
    Order[] orders;
|};

public type CustomerDatabase record {|
    Customer[] customers;
|};

public type ProductDatabase record {|
    Product[] products;
|};

// Order statistics
public type OrderStatistics record {|
    int totalOrders;
    int pendingOrders;
    int confirmedOrders;
    int shippedOrders;
    int deliveredOrders;
    int cancelledOrders;
    decimal totalRevenue;
    decimal averageOrderValue;
|};