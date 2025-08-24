// Order item structure
public type OrderItem record {|
    string itemName;
    int quantity;
    decimal unitPrice;
|};

// Order structure
public type Order record {|
    string orderId;
    string customerName;
    OrderItem[] items;
    decimal totalAmount;
    string status;
    string createdAt;
|};

// Request structure for creating orders
public type CreateOrderRequest record {|
    string customerName;
    OrderItem[] items;
|};

// Request structure for updating orders
public type UpdateOrderRequest record {|
    string customerName?;
    OrderItem[] items?;
    string status?;
|};

// Response structure for error messages
public type ErrorResponse record {|
    string message;
    string 'error;
|};