import ballerina/http;
import ballerina/time;

// In-memory storage for orders
map<Order> orderStorage = {};
int orderCounter = 1000;

// HTTP service for order management
service /api on new http:Listener(8080) {

    // Create a new order
    resource function post orders(CreateOrderRequest createRequest) returns Order|ErrorResponse|error {
        // Generate order ID
        orderCounter += 1;
        string orderId = string `ORD-${orderCounter}`;

        // Calculate total amount
        decimal totalAmount = 0;
        foreach OrderItem item in createRequest.items {
            totalAmount += item.quantity * item.unitPrice;
        }

        // Get current timestamp
        time:Utc currentTime = time:utcNow();
        string createdAt = time:utcToString(currentTime);

        // Create order
        Order newOrder = {
            orderId: orderId,
            customerName: createRequest.customerName,
            items: createRequest.items,
            totalAmount: totalAmount,
            status: "PENDING",
            createdAt: createdAt
        };

        // Store order
        orderStorage[orderId] = newOrder;

        return newOrder;
    }

    // Get all orders
    resource function get orders() returns Order[] {
        return orderStorage.toArray();
    }

    // Get specific order by ID
    resource function get orders/[string orderId]() returns Order|ErrorResponse|http:NotFound {
        if orderStorage.hasKey(orderId) {
            Order retrievedOrder = orderStorage.get(orderId);
            return retrievedOrder;
        } else {
            return http:NOT_FOUND;
        }
    }

    // Update an existing order
    resource function put orders/[string orderId](UpdateOrderRequest updateRequest) returns Order|ErrorResponse|http:NotFound {
        if !orderStorage.hasKey(orderId) {
            return http:NOT_FOUND;
        }

        Order existingOrder = orderStorage.get(orderId);

        // Update fields if provided
        string customerName = updateRequest.customerName ?: existingOrder.customerName;
        OrderItem[] items = updateRequest.items ?: existingOrder.items;
        string status = updateRequest.status ?: existingOrder.status;

        // Recalculate total if items changed
        decimal totalAmount = existingOrder.totalAmount;
        if updateRequest.items != () {
            totalAmount = 0;
            foreach OrderItem item in items {
                totalAmount += item.quantity * item.unitPrice;
            }
        }

        // Update order
        Order updatedOrder = {
            orderId: orderId,
            customerName: customerName,
            items: items,
            totalAmount: totalAmount,
            status: status,
            createdAt: existingOrder.createdAt
        };

        orderStorage[orderId] = updatedOrder;
        return updatedOrder;
    }

    // Delete an order
    resource function delete orders/[string orderId]() returns http:Ok|http:NotFound {
        if orderStorage.hasKey(orderId) {
            Order removedOrder = orderStorage.remove(orderId);
            return http:OK;
        } else {
            return http:NOT_FOUND;
        }
    }

    // Health check endpoint
    resource function get health() returns map<string> {
        return {
            "status": "UP",
            "service": "Order Management Service"
        };
    }
}
