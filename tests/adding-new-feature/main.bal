import ballerina/http;
import ballerina/time;

// In-memory storage for orders
map<Order> orderStorage = {};
int orderCounter = 1000;

// REST service with endpoints for order management and health check
service /api on new http:Listener(8080) {

    // Creates a new order
    resource function post orders(CreateOrderRequest createRequest) returns Order|ErrorResponse|error {

        // Validate required fields
        if createRequest.customerName.trim() == "" {
            return {
                message: "Customer name is required",
                'error: "VALIDATION_ERROR"
            };
        }

        if createRequest.customerEmail.trim() == "" {
            return {
                message: "Customer email is required",
                'error: "VALIDATION_ERROR"
            };
        }

        if createRequest.items.length() == 0 {
            return {
                message: "At least one item is required",
                'error: "VALIDATION_ERROR"
            };
        }

        // Generate new order ID
        orderCounter += 1;
        string newOrderId = orderCounter.toString();

        // Calculate total amount
        decimal totalAmount = 0;
        foreach OrderItem item in createRequest.items {
            totalAmount += item.quantity * item.unitPrice;
        }

        // Create new order
        Order newOrder = {
            orderId: newOrderId,
            customerName: createRequest.customerName,
            customerEmail: createRequest.customerEmail,
            items: createRequest.items,
            totalAmount: totalAmount,
            status: "PENDING",
            createdAt: time:utcToString(time:utcNow())
        };

        // Store the order
        orderStorage[newOrderId] = newOrder;

        return newOrder;
    }

    // Retrieves all orders
    resource function get orders() returns Order[] {
        return orderStorage.toArray();
    }

    // Retrieves an order by ID
    resource function get orders/[string orderId]() returns Order|ErrorResponse|http:NotFound {
        Order? orderResult = orderStorage[orderId];
        if orderResult is Order {
            return orderResult;
        } else {
            return http:NOT_FOUND;
        }
    }

    // Updates an existing order
    resource function put orders/[string orderId](UpdateOrderRequest updateRequest) returns Order|ErrorResponse|http:NotFound {
        Order? existingOrder = orderStorage[orderId];

        if existingOrder is () {
            return http:NOT_FOUND;
        }

        // Update fields if provided
        Order updatedOrder = existingOrder.clone();

        if updateRequest.customerName is string {
            string customerName = updateRequest.customerName;
            if customerName.trim() != "" {
                updatedOrder.customerName = customerName;
            }
        }

        if updateRequest.customerEmail is string {
            string customerEmail = updateRequest.customerEmail;
            if customerEmail.trim() != "" {
                updatedOrder.customerEmail = customerEmail;
            }
        }

        if updateRequest.items is OrderItem[] {
            OrderItem[] items = updateRequest.items;
            updatedOrder.items = items;

            // Recalculate total amount
            decimal totalAmount = 0;
            foreach OrderItem item in items {
                totalAmount += item.quantity * item.unitPrice;
            }
            updatedOrder.totalAmount = totalAmount;
        }

        if updateRequest.status is string {
            string status = updateRequest.status;
            updatedOrder.status = status;
        }

        // Store updated order
        orderStorage[orderId] = updatedOrder;

        return updatedOrder;
    }

    // Deletes an order by ID
    resource function delete orders/[string orderId]() returns http:Ok|http:NotFound {
        if orderStorage.hasKey(orderId) {
            _ = orderStorage.remove(orderId);
            return http:OK;
        } else {
            return http:NOT_FOUND;
        }
    }

    // Returns service health status
    resource function get health() returns map<string> {
        return {
            "status": "UP",
            "timestamp": time:utcToString(time:utcNow())
        };
    }
}
