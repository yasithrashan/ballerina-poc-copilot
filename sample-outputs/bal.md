# Codebase High-Level Summary

## Project Files
- `main.bal` - Main service implementation with API endpoints and business logic
- `types.bal` - Type definitions for the project

---

## File Name: main.bal

### Imports
- `import ballerina/http;`
- `import ballerina/time;`
- `import ballerinax/mysql;`
- `import ballerinax/stripe;`
- `import ballerina/sql;`

---

### Configurable Variables
- `dbHost` - string - `"localhost"`
- `dbUser` - string - `"root"`
- `dbPassword` - string - `""`
- `dbName` - string - `"order_management"`
- `dbPort` - int - `3306`
- `stripeApiKey` - string - `""`

### Module Level Variables
- `dbClient` - mysql:Client
- `stripeClient` - stripe:Client

---

### Services
HTTP: `/api/v1` on port `8080`

---

### Endpoints

#### `/api/v1/customers`

* **POST /**
   * **Parameters**:
      * **Body / Payload Parameter**:
         * `customerRequest` - CreateCustomerRequest - Customer details to create
   * **Returns**: `ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Successful creation of customer
     - `400 Bad Request` - Invalid input data
     - `500 Internal Server Error` - Database or Stripe API error

#### `/api/v1/customers/[int customerId]`

* **GET /**
   * **Parameters**:
      * **Path Parameter**:
         * `customerId` - int - ID of the customer to retrieve
   * **Returns**: `Customer|ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Customer found and returned
     - `404 Not Found` - Customer not found
     - `500 Internal Server Error` - Database error

#### `/api/v1/products`

* **POST /**
   * **Parameters**:
      * **Body / Payload Parameter**:
         * `productRequest` - CreateProductRequest - Product details to create
   * **Returns**: `ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Successful creation of product
     - `400 Bad Request` - Invalid input data
     - `500 Internal Server Error` - Database or Stripe API error

* **GET /**
   * **Parameters**: None
   * **Returns**: `Product[]|error`
   * **Status Codes**:
     - `200 OK` - List of active products returned
     - `500 Internal Server Error` - Database error

#### `/api/v1/orders`

* **POST /**
   * **Parameters**:
      * **Body / Payload Parameter**:
         * `orderRequest` - CreateOrderRequest - Order details to create
   * **Returns**: `ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Successful creation of order
     - `400 Bad Request` - Invalid input data or customer/product not found
     - `500 Internal Server Error` - Database or Stripe API error

* **GET /**
   * **Parameters**: None
   * **Returns**: `OrderSummary[]|error`
   * **Status Codes**:
     - `200 OK` - List of order summaries returned
     - `500 Internal Server Error` - Database error

#### `/api/v1/orders/[int orderId]`

* **GET /**
   * **Parameters**:
      * **Path Parameter**:
         * `orderId` - int - ID of the order to retrieve
   * **Returns**: `Order|ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Order found and returned
     - `404 Not Found` - Order not found
     - `500 Internal Server Error` - Database error

#### `/api/v1/orders/[int orderId]/status`

* **PUT /**
   * **Parameters**:
      * **Path Parameter**:
         * `orderId` - int - ID of the order to update
      * **Body / Payload Parameter**:
         * `statusRequest` - UpdateOrderStatusRequest - New status for the order
   * **Returns**: `ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Order status updated successfully
     - `404 Not Found` - Order not found
     - `500 Internal Server Error` - Database error

#### `/api/v1/orders/[int orderId]/invoice`

* **POST /**
   * **Parameters**:
      * **Path Parameter**:
         * `orderId` - int - ID of the order to create an invoice for
   * **Returns**: `ApiResponse|error`
   * **Status Codes**:
     - `200 OK` - Invoice created successfully
     - `404 Not Found` - Order not found
     - `400 Bad Request` - Customer does not have Stripe integration
     - `500 Internal Server Error` - Database or Stripe API error

---

### Functions

* **None**

---

## File Name: types.bal

### Imports
- `import ballerina/time;`

---

### Configurable Variables
- None

### Module Level Variables
- None

---

### Functions

* **None**

---

### Type Definitions

* **Customer**
   * **Fields**:
      * `customerId` - int [optional]
      * `name` - string
      * `email` - string
      * `phone` - string?
      * `address` - string?
      * `stripeCustomerId` - string?
      * `createdAt` - time:Utc [optional]

* **Product**
   * **Fields**:
      * `productId` - int [optional]
      * `name` - string
      * `description` - string
      * `price` - decimal
      * `currency` - string
      * `active` - boolean
      * `stripeProductId` - string?
      * `stripePriceId` - string?
      * `createdAt` - time:Utc [optional]

* **Order**
   * **Fields**:
      * `orderId` - int [optional]
      * `customerId` - int
      * `status` - string
      * `totalAmount` - decimal
      * `currency` - string
      * `stripePaymentIntentId` - string?
      * `stripeInvoiceId` - string?
      * `items` - OrderItem[]
      * `createdAt` - time:Utc [optional]
      * `updatedAt` - time:Utc?

* **OrderItem**
   * **Fields**:
      * `orderItemId` - int [optional]
      * `orderId` - int [optional]
      * `productId` - int
      * `quantity` - int
      * `unitPrice` - decimal
      * `totalPrice` - decimal

* **CreateCustomerRequest**
   * **Fields**:
      * `name` - string
      * `email` - string
      * `phone` - string?
      * `address` - string?

* **CreateProductRequest**
   * **Fields**:
      * `name` - string
      * `description` - string
      * `price` - decimal
      * `currency` - string
      * `active` - boolean

* **CreateOrderRequest**
   * **Fields**:
      * `customerId` - int
      * `items` - OrderItemRequest[]

* **OrderItemRequest**
   * **Fields**:
      * `productId` - int
      * `quantity` - int

* **UpdateOrderStatusRequest**
   * **Fields**:
      * `status` - string

* **ApiResponse**
   * **Fields**:
      * `success` - boolean
      * `message` - string
      * `data` - anydata?

* **OrderSummary**
   * **Fields**:
      * `orderId` - int
      * `customerId` - int
      * `customerName` - string
      * `status` - string
      * `totalAmount` - decimal
      * `currency` - string
      * `itemCount` - int
      * `createdAt` - time:Utc

* **InvoiceResponse**
   * **Fields**:
      * `orderId` - int
      * `invoiceId` - string
      * `invoiceUrl` - string?