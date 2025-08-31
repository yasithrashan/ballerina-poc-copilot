import ballerina/http;
import ballerina/time;
import ballerina/io;
import ballerina/uuid;
import ballerinax/stripe;

// Configuration
configurable string stripeApiKey = ?;
configurable int serverPort = 8080;

// Initialize Stripe client
stripe:Client stripeClient = check new({
    auth: {
        token: stripeApiKey
    }
});

// Data file paths
const string ORDERS_FILE = "./data/orders.json";
const string CUSTOMERS_FILE = "./data/customers.json";
const string PRODUCTS_FILE = "./data/products.json";

// HTTP service for order management
service /orderManagement on new http:Listener(serverPort) {

    // Create a new customer
    resource function post customers(CustomerRequest customerRequest) returns Customer|ErrorResponse {
        do {
            // Create customer in Stripe
            stripe:customers_body stripeCustomerRequest = {
                name: customerRequest.name,
                email: customerRequest.email,
                phone: customerRequest.phone
            };

            stripe:Customer stripeCustomer = check stripeClient->/customers.post(payload = stripeCustomerRequest);

            // Create local customer record
            Customer customer = {
                customerId: uuid:createType1AsString(),
                name: customerRequest.name,
                email: customerRequest.email,
                phone: customerRequest.phone,
                address: customerRequest.address,
                stripeCustomerId: stripeCustomer.id,
                createdAt: time:utcNow()
            };

            // Save customer locally
            check saveCustomer(customer);

            return customer;
        } on fail error e {
            return {
                message: "Failed to create customer: " + e.message(),
                errorCode: "CUSTOMER_CREATION_FAILED"
            };
        }
    }

    // Get all customers
    resource function get customers() returns Customer[]|ErrorResponse {
        do {
            CustomerData customerData = check loadCustomers();
            return customerData.customers;
        } on fail error e {
            return {
                message: "Failed to retrieve customers: " + e.message(),
                errorCode: "CUSTOMER_RETRIEVAL_FAILED"
            };
        }
    }

    // Create a new product
    resource function post products(ProductRequest productRequest) returns Product|ErrorResponse {
        do {
            // Create product in Stripe
            stripe:products_body stripeProductRequest = {
                name: productRequest.name,
                description: productRequest.description,
                active: productRequest.active ?: true
            };

            stripe:Product stripeProduct = check stripeClient->/products.post(payload = stripeProductRequest);

            // Create price in Stripe
            stripe:prices_body stripePriceRequest = {
                product: stripeProduct.id,
                unit_amount: <int>(productRequest.price * 100), // Convert to cents
                currency: "usd",
                active: productRequest.active ?: true
            };

            stripe:Price stripePrice = check stripeClient->/prices.post(payload = stripePriceRequest);

            // Create local product record
            Product product = {
                productId: uuid:createType1AsString(),
                name: productRequest.name,
                description: productRequest.description,
                price: productRequest.price,
                stripePriceId: stripePrice.id,
                stripeProductId: stripeProduct.id,
                active: productRequest.active ?: true,
                stockQuantity: productRequest.stockQuantity
            };

            // Save product locally
            check saveProduct(product);

            return product;
        } on fail error e {
            return {
                message: "Failed to create product: " + e.message(),
                errorCode: "PRODUCT_CREATION_FAILED"
            };
        }
    }

    // Get all products
    resource function get products() returns Product[]|ErrorResponse {
        do {
            ProductData productData = check loadProducts();
            return productData.products;
        } on fail error e {
            return {
                message: "Failed to retrieve products: " + e.message(),
                errorCode: "PRODUCT_RETRIEVAL_FAILED"
            };
        }
    }

    // Create a new order
    resource function post orders(OrderRequest orderRequest) returns OrderResponse|ErrorResponse {
        do {
            // Validate customer exists
            Customer? customer = check getCustomerById(orderRequest.customerId);
            if customer is () {
                return {
                    message: "Customer not found",
                    errorCode: "CUSTOMER_NOT_FOUND"
                };
            }

            // Calculate total amount and validate products
            decimal totalAmount = 0;
            OrderItem[] validatedItems = [];

            foreach OrderItem item in orderRequest.items {
                Product? product = check getProductById(item.productId);
                if product is () {
                    return {
                        message: "Product not found: " + item.productId,
                        errorCode: "PRODUCT_NOT_FOUND"
                    };
                }

                if product.stockQuantity < item.quantity {
                    return {
                        message: "Insufficient stock for product: " + product.name,
                        errorCode: "INSUFFICIENT_STOCK"
                    };
                }

                decimal itemTotal = product.price * item.quantity;
                totalAmount += itemTotal;

                OrderItem validatedItem = {
                    productId: item.productId,
                    productName: product.name,
                    quantity: item.quantity,
                    unitPrice: product.price,
                    totalPrice: itemTotal
                };
                validatedItems.push(validatedItem);
            }

            // Create order
            string orderId = uuid:createType1AsString();
            Order 'order = {
                orderId: orderId,
                customerId: orderRequest.customerId,
                items: validatedItems,
                totalAmount: totalAmount,
                status: "PENDING",
                paymentStatus: "PENDING",
                stripeInvoiceId: (),
                stripeSubscriptionId: (),
                createdAt: time:utcNow(),
                updatedAt: (),
                shippingAddress: orderRequest.shippingAddress,
                notes: orderRequest.notes
            };

            // Handle subscription or one-time payment
            if orderRequest.isSubscription ?: false {
                check handleSubscriptionOrder('order, customer);
            } else {
                check handleOneTimeOrder('order, customer);
            }

            // Save order locally
            check saveOrder('order);

            return {
                orderId: orderId,
                message: "Order created successfully",
                status: 'order.status,
                totalAmount: totalAmount
            };
        } on fail error e {
            return {
                message: "Failed to create order: " + e.message(),
                errorCode: "ORDER_CREATION_FAILED"
            };
        }
    }

    // Get all orders
    resource function get orders() returns Order[]|ErrorResponse {
        do {
            OrderData orderData = check loadOrders();
            return orderData.orders;
        } on fail error e {
            return {
                message: "Failed to retrieve orders: " + e.message(),
                errorCode: "ORDER_RETRIEVAL_FAILED"
            };
        }
    }

    // Get order by ID
    resource function get orders/[string orderId]() returns Order|ErrorResponse {
        do {
            Order? 'order = check getOrderById(orderId);
            if 'order is () {
                return {
                    message: "Order not found",
                    errorCode: "ORDER_NOT_FOUND"
                };
            }
            return 'order;
        } on fail error e {
            return {
                message: "Failed to retrieve order: " + e.message(),
                errorCode: "ORDER_RETRIEVAL_FAILED"
            };
        }
    }

    // Update order status
    resource function put orders/[string orderId]/status(record {| OrderStatus status; |} statusUpdate) returns Order|ErrorResponse {
        do {
            Order? existingOrder = check getOrderById(orderId);
            if existingOrder is () {
                return {
                    message: "Order not found",
                    errorCode: "ORDER_NOT_FOUND"
                };
            }

            Order updatedOrder = {
                orderId: existingOrder.orderId,
                customerId: existingOrder.customerId,
                items: existingOrder.items,
                totalAmount: existingOrder.totalAmount,
                status: statusUpdate.status,
                paymentStatus: existingOrder.paymentStatus,
                stripeInvoiceId: existingOrder.stripeInvoiceId,
                stripeSubscriptionId: existingOrder.stripeSubscriptionId,
                createdAt: existingOrder.createdAt,
                updatedAt: time:utcNow(),
                shippingAddress: existingOrder.shippingAddress,
                notes: existingOrder.notes
            };

            check updateOrder(updatedOrder);
            return updatedOrder;
        } on fail error e {
            return {
                message: "Failed to update order status: " + e.message(),
                errorCode: "ORDER_UPDATE_FAILED"
            };
        }
    }
}

// Helper functions for data management
function saveCustomer(Customer customer) returns error? {
    CustomerData customerData;
    do {
        customerData = check loadCustomers();
    } on fail {
        customerData = {customers: []};
    }
    customerData.customers.push(customer);
    check io:fileWriteJson(path = CUSTOMERS_FILE, content = customerData);
}

function saveProduct(Product product) returns error? {
    ProductData productData;
    do {
        productData = check loadProducts();
    } on fail {
        productData = {products: []};
    }
    productData.products.push(product);
    check io:fileWriteJson(path = PRODUCTS_FILE, content = productData);
}

function saveOrder(Order 'order) returns error? {
    OrderData orderData;
    do {
        orderData = check loadOrders();
    } on fail {
        orderData = {orders: []};
    }
    orderData.orders.push('order);
    check io:fileWriteJson(path = ORDERS_FILE, content = orderData);
}

function loadCustomers() returns CustomerData|error {
    json customerJson = check io:fileReadJson(path = CUSTOMERS_FILE);
    return customerJson.cloneWithType(CustomerData);
}

function loadProducts() returns ProductData|error {
    json productJson = check io:fileReadJson(path = PRODUCTS_FILE);
    return productJson.cloneWithType(ProductData);
}

function loadOrders() returns OrderData|error {
    json orderJson = check io:fileReadJson(path = ORDERS_FILE);
    return orderJson.cloneWithType(OrderData);
}

function getCustomerById(string customerId) returns Customer|error? {
    do {
        CustomerData customerData = check loadCustomers();
        foreach Customer customer in customerData.customers {
            if customer.customerId == customerId {
                return customer;
            }
        }
        return ();
    } on fail {
        return ();
    }
}

function getProductById(string productId) returns Product|error? {
    do {
        ProductData productData = check loadProducts();
        foreach Product product in productData.products {
            if product.productId == productId {
                return product;
            }
        }
        return ();
    } on fail {
        return ();
    }
}

function getOrderById(string orderId) returns Order|error? {
    do {
        OrderData orderData = check loadOrders();
        foreach Order 'order in orderData.orders {
            if 'order.orderId == orderId {
                return 'order;
            }
        }
        return ();
    } on fail {
        return ();
    }
}

function updateOrder(Order updatedOrder) returns error? {
    OrderData orderData = check loadOrders();
    foreach int i in 0 ..< orderData.orders.length() {
        if orderData.orders[i].orderId == updatedOrder.orderId {
            orderData.orders[i] = updatedOrder;
            break;
        }
    }
    check io:fileWriteJson(path = ORDERS_FILE, content = orderData);
}

function handleOneTimeOrder(Order 'order, Customer customer) returns error? {
    string stripeCustomerId = customer.stripeCustomerId ?: "";

    // Create invoice in Stripe for one-time payment
    stripe:invoices_body invoiceRequest = {
        customer: stripeCustomerId,
        collection_method: "charge_automatically",
        auto_advance: true
    };

    stripe:Invoice invoice = check stripeClient->/invoices.post(payload = invoiceRequest);

    // Add invoice items for each order item
    foreach OrderItem item in 'order.items {
        Product? product = check getProductById(item.productId);
        if product is Product {
            stripe:invoiceitems_body invoiceItemRequest = {
                customer: stripeCustomerId,
                invoice: invoice.id,
                amount: <int>(item.totalPrice * 100), // Convert to cents
                currency: "usd",
                description: item.productName
            };

            stripe:Invoiceitem _ = check stripeClient->/invoiceitems.post(payload = invoiceItemRequest);
        }
    }

    'order.stripeInvoiceId = invoice.id;
    'order.status = "CONFIRMED";
}

function handleSubscriptionOrder(Order 'order, Customer customer) returns error? {
    string stripeCustomerId = customer.stripeCustomerId ?: "";

    // Create subscription for recurring orders
    stripe:subscription_item_create_params[] subscriptionItems = [];

    foreach OrderItem item in 'order.items {
        Product? product = check getProductById(item.productId);
        if product is Product {
            string stripePriceId = product.stripePriceId ?: "";
            stripe:subscription_item_create_params subscriptionItem = {
                price: stripePriceId,
                quantity: item.quantity
            };
            subscriptionItems.push(subscriptionItem);
        }
    }

    stripe:subscriptions_body subscriptionRequest = {
        customer: stripeCustomerId,
        items: subscriptionItems,
        collection_method: "charge_automatically"
    };

    stripe:Subscription subscription = check stripeClient->/subscriptions.post(payload = subscriptionRequest);

    'order.stripeSubscriptionId = subscription.id;
    'order.status = "CONFIRMED";
}