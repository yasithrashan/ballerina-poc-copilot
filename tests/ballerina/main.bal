import ballerina/http;
import ballerina/io;
import ballerina/time;

// Configuration
configurable string serverHost = "localhost";
configurable int serverPort = 8080;
configurable string ordersFilePath = "./data/orders.json";
configurable string customersFilePath = "./data/customers.json";
configurable string productsFilePath = "./data/products.json";
configurable decimal taxRate = 0.08;
configurable decimal shippingRate = 10.00;

// HTTP listener
listener http:Listener httpListener = new (serverPort, config = {host: serverHost});

// Order Management Service
service /api/v1 on httpListener {

    // Create a new order
    resource function post orders(CreateOrderRequest orderRequest) returns OrderResponse|http:BadRequest|http:InternalServerError {
        do {
            // Validate customer exists
            Customer? customer = check getCustomerById(orderRequest.customerId);
            if customer is () {
                return <http:BadRequest>{
                    body: {
                        success: false,
                        message: "Customer not found",
                        errorCode: "CUSTOMER_NOT_FOUND"
                    }
                };
            }

            // Validate and calculate order items
            OrderItem[] orderItems = [];
            decimal subtotal = 0.0;
            decimal totalWeight = 0.0;

            foreach OrderItemRequest itemRequest in orderRequest.items {
                Product? product = check getProductById(itemRequest.productId);
                if product is () {
                    return <http:BadRequest>{
                        body: {
                            success: false,
                            message: string `Product ${itemRequest.productId} not found`,
                            errorCode: "PRODUCT_NOT_FOUND"
                        }
                    };
                }

                Product validProduct = <Product>product;

                // Check stock availability
                if validProduct.stockQuantity < itemRequest.quantity {
                    return <http:BadRequest>{
                        body: {
                            success: false,
                            message: string `Insufficient stock for product ${validProduct.name}`,
                            errorCode: "INSUFFICIENT_STOCK"
                        }
                    };
                }

                decimal itemTotal = validProduct.price * <decimal>itemRequest.quantity;
                decimal itemWeight = validProduct.weight * <decimal>itemRequest.quantity;

                OrderItem orderItem = {
                    productId: validProduct.productId,
                    productName: validProduct.name,
                    quantity: itemRequest.quantity,
                    unitPrice: validProduct.price,
                    totalPrice: itemTotal,
                    weight: itemWeight
                };

                orderItems.push(orderItem);
                subtotal += itemTotal;
                totalWeight += itemWeight;
            }

            // Calculate totals
            decimal discountAmount = orderRequest.discountAmount ?: 0.0;
            decimal taxAmount = (subtotal - discountAmount) * taxRate;
            decimal shippingCost = calculateShippingCost(totalWeight);
            decimal totalAmount = subtotal - discountAmount + taxAmount + shippingCost;

            // Create order
            time:Utc currentTime = time:utcNow();
            string orderId = generateOrderId();

            Order newOrder = {
                orderId: orderId,
                customerId: orderRequest.customerId,
                items: orderItems,
                subtotal: subtotal,
                taxAmount: taxAmount,
                discountAmount: discountAmount,
                shippingCost: shippingCost,
                totalAmount: totalAmount,
                status: PENDING,
                paymentStatus: PENDING,
                shippingAddress: orderRequest.shippingAddress,
                billingAddress: orderRequest.billingAddress,
                notes: orderRequest.notes,
                createdAt: currentTime,
                updatedAt: currentTime,
                shippedAt: (),
                deliveredAt: (),
                trackingNumber: ()
            };

            // Save order
            check saveOrder(newOrder);

            // Update product stock
            foreach OrderItem item in orderItems {
                check updateProductStock(item.productId, -item.quantity);
            }

            return {
                success: true,
                message: "Order created successfully",
                data: newOrder
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to create order: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Get all orders
    resource function get orders(string? customerId = (), string? status = (), int 'limit = 50, int offset = 0)
            returns OrderListResponse|http:InternalServerError {
        do {
            Order[] allOrders = check loadOrders();
            Order[] filteredOrders = allOrders;

            // Filter by customer ID
            if customerId is string {
                Order[] customerFilteredOrders = [];
                foreach Order orderItem in filteredOrders {
                    if orderItem.customerId == customerId {
                        customerFilteredOrders.push(orderItem);
                    }
                }
                filteredOrders = customerFilteredOrders;
            }

            // Filter by status
            if status is string {
                OrderStatus? orderStatus = getOrderStatusFromString(status);
                if orderStatus is OrderStatus {
                    Order[] statusFilteredOrders = [];
                    foreach Order orderItem in filteredOrders {
                        if orderItem.status == orderStatus {
                            statusFilteredOrders.push(orderItem);
                        }
                    }
                    filteredOrders = statusFilteredOrders;
                }
            }

            // Apply pagination
            int totalCount = filteredOrders.length();
            int endIndex = offset + 'limit;
            if endIndex > totalCount {
                endIndex = totalCount;
            }

            Order[] paginatedOrders = [];
            if offset < totalCount {
                paginatedOrders = filteredOrders.slice(offset, endIndex);
            }

            return {
                success: true,
                message: "Orders retrieved successfully",
                data: paginatedOrders,
                totalCount: totalCount
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve orders: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Get order by ID
    resource function get orders/[string orderId]() returns OrderResponse|http:NotFound|http:InternalServerError {
        do {
            Order? orderData = check getOrderById(orderId);
            if orderData is () {
                return <http:NotFound>{
                    body: {
                        success: false,
                        message: "Order not found",
                        errorCode: "ORDER_NOT_FOUND"
                    }
                };
            }

            return {
                success: true,
                message: "Order retrieved successfully",
                data: orderData
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve order: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Update order
    resource function put orders/[string orderId](UpdateOrderRequest updateRequest)
            returns OrderResponse|http:NotFound|http:BadRequest|http:InternalServerError {
        do {
            Order? existingOrder = check getOrderById(orderId);
            if existingOrder is () {
                return <http:NotFound>{
                    body: {
                        success: false,
                        message: "Order not found",
                        errorCode: "ORDER_NOT_FOUND"
                    }
                };
            }

            Order currentOrder = <Order>existingOrder;
            time:Utc currentTime = time:utcNow();

            // Determine new values
            OrderStatus newStatus = updateRequest.status ?: currentOrder.status;
            PaymentStatus newPaymentStatus = updateRequest.paymentStatus ?: currentOrder.paymentStatus;
            string? newTrackingNumber = updateRequest.trackingNumber ?: currentOrder.trackingNumber;
            string? newNotes = updateRequest.notes ?: currentOrder.notes;

            // Determine shipped/delivered timestamps
            time:Utc? newShippedAt = currentOrder.shippedAt;
            time:Utc? newDeliveredAt = currentOrder.deliveredAt;

            if updateRequest.status == SHIPPED && currentOrder.status != SHIPPED {
                newShippedAt = currentTime;
            }
            if updateRequest.status == DELIVERED && currentOrder.status != DELIVERED {
                newDeliveredAt = currentTime;
            }

            // Create updated order
            Order updatedOrder = {
                orderId: currentOrder.orderId,
                customerId: currentOrder.customerId,
                items: currentOrder.items,
                subtotal: currentOrder.subtotal,
                taxAmount: currentOrder.taxAmount,
                discountAmount: currentOrder.discountAmount,
                shippingCost: currentOrder.shippingCost,
                totalAmount: currentOrder.totalAmount,
                status: newStatus,
                paymentStatus: newPaymentStatus,
                shippingAddress: currentOrder.shippingAddress,
                billingAddress: currentOrder.billingAddress,
                notes: newNotes,
                createdAt: currentOrder.createdAt,
                updatedAt: currentTime,
                shippedAt: newShippedAt,
                deliveredAt: newDeliveredAt,
                trackingNumber: newTrackingNumber
            };

            // Save updated order
            check updateOrder(updatedOrder);

            return {
                success: true,
                message: "Order updated successfully",
                data: updatedOrder
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to update order: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Cancel order
    resource function delete orders/[string orderId]() returns OrderResponse|http:NotFound|http:BadRequest|http:InternalServerError {
        do {
            Order? existingOrder = check getOrderById(orderId);
            if existingOrder is () {
                return <http:NotFound>{
                    body: {
                        success: false,
                        message: "Order not found",
                        errorCode: "ORDER_NOT_FOUND"
                    }
                };
            }

            Order currentOrder = <Order>existingOrder;

            // Check if order can be cancelled
            if currentOrder.status == SHIPPED || currentOrder.status == DELIVERED {
                return <http:BadRequest>{
                    body: {
                        success: false,
                        message: "Cannot cancel shipped or delivered order",
                        errorCode: "INVALID_ORDER_STATUS"
                    }
                };
            }

            // Create cancelled order
            Order cancelledOrder = {
                orderId: currentOrder.orderId,
                customerId: currentOrder.customerId,
                items: currentOrder.items,
                subtotal: currentOrder.subtotal,
                taxAmount: currentOrder.taxAmount,
                discountAmount: currentOrder.discountAmount,
                shippingCost: currentOrder.shippingCost,
                totalAmount: currentOrder.totalAmount,
                status: CANCELLED,
                paymentStatus: currentOrder.paymentStatus,
                shippingAddress: currentOrder.shippingAddress,
                billingAddress: currentOrder.billingAddress,
                notes: currentOrder.notes,
                createdAt: currentOrder.createdAt,
                updatedAt: time:utcNow(),
                shippedAt: currentOrder.shippedAt,
                deliveredAt: currentOrder.deliveredAt,
                trackingNumber: currentOrder.trackingNumber
            };

            check updateOrder(cancelledOrder);

            // Restore product stock
            foreach OrderItem item in currentOrder.items {
                check updateProductStock(item.productId, item.quantity);
            }

            return {
                success: true,
                message: "Order cancelled successfully",
                data: cancelledOrder
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to cancel order: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Get order statistics
    resource function get orders/statistics() returns json|http:InternalServerError {
        do {
            Order[] allOrders = check loadOrders();

            int totalOrders = allOrders.length();

            int pendingOrders = 0;
            int confirmedOrders = 0;
            int shippedOrders = 0;
            int deliveredOrders = 0;
            int cancelledOrders = 0;

            foreach Order orderItem in allOrders {
                if orderItem.status == PENDING {
                    pendingOrders += 1;
                } else if orderItem.status == CONFIRMED {
                    confirmedOrders += 1;
                } else if orderItem.status == SHIPPED {
                    shippedOrders += 1;
                } else if orderItem.status == DELIVERED {
                    deliveredOrders += 1;
                } else if orderItem.status == CANCELLED {
                    cancelledOrders += 1;
                }
            }

            decimal totalRevenue = 0.0;
            foreach Order orderItem in allOrders {
                if orderItem.status != CANCELLED {
                    totalRevenue += orderItem.totalAmount;
                }
            }

            decimal averageOrderValue = totalOrders > 0 ? totalRevenue / <decimal>totalOrders : 0.0;

            OrderStatistics stats = {
                totalOrders: totalOrders,
                pendingOrders: pendingOrders,
                confirmedOrders: confirmedOrders,
                shippedOrders: shippedOrders,
                deliveredOrders: deliveredOrders,
                cancelledOrders: cancelledOrders,
                totalRevenue: totalRevenue,
                averageOrderValue: averageOrderValue
            };

            return {
                success: true,
                message: "Statistics retrieved successfully",
                data: stats
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve statistics: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Customer management endpoints
    resource function get customers() returns json|http:InternalServerError {
        do {
            Customer[] customers = check loadCustomers();
            return {
                success: true,
                message: "Customers retrieved successfully",
                data: customers,
                totalCount: customers.length()
            };
        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve customers: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    resource function get customers/[string customerId]() returns CustomerResponse|http:NotFound|http:InternalServerError {
        do {
            Customer? customer = check getCustomerById(customerId);
            if customer is () {
                return <http:NotFound>{
                    body: {
                        success: false,
                        message: "Customer not found",
                        errorCode: "CUSTOMER_NOT_FOUND"
                    }
                };
            }

            return {
                success: true,
                message: "Customer retrieved successfully",
                data: customer
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve customer: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    // Product management endpoints
    resource function get products() returns ProductListResponse|http:InternalServerError {
        do {
            Product[] products = check loadProducts();
            return {
                success: true,
                message: "Products retrieved successfully",
                data: products,
                totalCount: products.length()
            };
        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve products: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }

    resource function get products/[string productId]() returns ProductResponse|http:NotFound|http:InternalServerError {
        do {
            Product? product = check getProductById(productId);
            if product is () {
                return <http:NotFound>{
                    body: {
                        success: false,
                        message: "Product not found",
                        errorCode: "PRODUCT_NOT_FOUND"
                    }
                };
            }

            return {
                success: true,
                message: "Product retrieved successfully",
                data: product
            };

        } on fail error e {
            return <http:InternalServerError>{
                body: {
                    success: false,
                    message: "Failed to retrieve product: " + e.message(),
                    errorCode: "INTERNAL_ERROR"
                }
            };
        }
    }
}

// Utility functions
function generateOrderId() returns string {
    time:Utc currentTime = time:utcNow();
    int timestamp = <int>currentTime[0];
    return string `ORD-${timestamp}`;
}

function calculateShippingCost(decimal weight) returns decimal {
    decimal weightLimit = 1.0;
    if weight <= weightLimit {
        return shippingRate;
    } else {
        return shippingRate + ((weight - weightLimit) * 2.0);
    }
}

function getOrderStatusFromString(string status) returns OrderStatus? {
    string lowerStatus = status.toLowerAscii();
    if lowerStatus == "pending" {
        return PENDING;
    } else if lowerStatus == "confirmed" {
        return CONFIRMED;
    } else if lowerStatus == "processing" {
        return PROCESSING;
    } else if lowerStatus == "shipped" {
        return SHIPPED;
    } else if lowerStatus == "delivered" {
        return DELIVERED;
    } else if lowerStatus == "cancelled" {
        return CANCELLED;
    } else {
        return ();
    }
}

// Data access functions
function loadOrders() returns Order[]|error {
    json|io:Error result = io:fileReadJson(ordersFilePath);
    if result is io:Error {
        // Return empty array if file doesn't exist
        return [];
    }

    OrderDatabase|error database = result.cloneWithType(OrderDatabase);
    if database is error {
        return [];
    }

    return database.orders;
}

function saveOrder(Order newOrder) returns error? {
    Order[] orders = check loadOrders();
    orders.push(newOrder);

    OrderDatabase database = {orders: orders};
    check io:fileWriteJson(ordersFilePath, database.toJson());
}

function updateOrder(Order updatedOrder) returns error? {
    Order[] orders = check loadOrders();

    foreach int i in 0 ..< orders.length() {
        if orders[i].orderId == updatedOrder.orderId {
            orders[i] = updatedOrder;
            break;
        }
    }

    OrderDatabase database = {orders: orders};
    check io:fileWriteJson(ordersFilePath, database.toJson());
}

function getOrderById(string orderId) returns Order?|error {
    Order[] orders = check loadOrders();

    foreach Order orderItem in orders {
        if orderItem.orderId == orderId {
            return orderItem;
        }
    }

    return ();
}

function loadCustomers() returns Customer[]|error {
    json|io:Error result = io:fileReadJson(customersFilePath);
    if result is io:Error {
        return [];
    }

    CustomerDatabase|error database = result.cloneWithType(CustomerDatabase);
    if database is error {
        return [];
    }

    return database.customers;
}

function getCustomerById(string customerId) returns Customer?|error {
    Customer[] customers = check loadCustomers();

    foreach Customer customer in customers {
        if customer.customerId == customerId {
            return customer;
        }
    }

    return ();
}

function loadProducts() returns Product[]|error {
    json|io:Error result = io:fileReadJson(productsFilePath);
    if result is io:Error {
        return [];
    }

    ProductDatabase|error database = result.cloneWithType(ProductDatabase);
    if database is error {
        return [];
    }

    return database.products;
}

function getProductById(string productId) returns Product?|error {
    Product[] products = check loadProducts();

    foreach Product product in products {
        if product.productId == productId {
            return product;
        }
    }

    return ();
}

function updateProductStock(string productId, int quantityChange) returns error? {
    Product[] products = check loadProducts();

    foreach int i in 0 ..< products.length() {
        if products[i].productId == productId {
            Product currentProduct = products[i];
            int newStockQuantity = currentProduct.stockQuantity + quantityChange;
            time:Utc newUpdatedAt = time:utcNow();

            Product updatedProduct = {
                productId: currentProduct.productId,
                name: currentProduct.name,
                description: currentProduct.description,
                category: currentProduct.category,
                price: currentProduct.price,
                stockQuantity: newStockQuantity,
                weight: currentProduct.weight,
                tags: currentProduct.tags,
                isActive: currentProduct.isActive,
                createdAt: currentProduct.createdAt,
                updatedAt: newUpdatedAt
            };

            products[i] = updatedProduct;
            break;
        }
    }

    ProductDatabase database = {products: products};
    check io:fileWriteJson(productsFilePath, database.toJson());
}