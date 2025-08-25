// Order item details
public type OrderItem record {
    string itemName;
    int quantity;
    decimal unitPrice;
};

// Complete order information
public type Order record {
    string orderId;
    string customerName;
    string customerEmail;
    OrderItem[] items;
    decimal totalAmount;
    string status;
    string createdAt;
};

// Request payload for creating a new order
public type CreateOrderRequest record {
    string customerName;
    string customerEmail;
    OrderItem[] items;
};

// Request payload for updating an existing order
public type UpdateOrderRequest record {
    string? customerName;
    string? customerEmail;
    OrderItem[]? items;
    string? status;
};

// Error response format
public type ErrorResponse record {
    string message;
    string 'error;
};