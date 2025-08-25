# Simple Summary of the Codebase

## main.bal

**imports**
- ballerina/http
- ballerina/time

**types**
- no types (uses types from `types.bal`)

**variables**
- orderStorage: map<Order> (in-memory storage)
- orderCounter: int (initial value 1000)

**services**
- /api
  - doc comments: REST service with endpoints for order management and health check

**resource functions**
- post orders
  - doc comments: Creates a new order
  - parameters: createRequest: CreateOrderRequest
  - return: Order | ErrorResponse | error

- get orders
  - doc comments: Retrieves all orders
  - parameters: none
  - return: Order[]

- get orders/[string orderId]
  - doc comments: Retrieves an order by ID
  - parameters: orderId: string
  - return: Order | ErrorResponse | http:NotFound

- put orders/[string orderId]
  - doc comments: Updates an existing order
  - parameters: orderId: string, updateRequest: UpdateOrderRequest
  - return: Order | ErrorResponse | http:NotFound

- delete orders/[string orderId]
  - doc comments: Deletes an order by ID
  - parameters: orderId: string
  - return: http:Ok | http:NotFound

- get health
  - doc comments: Returns service health status
  - parameters: none
  - return: map<string>


## types.bal

**imports**
- none

**types**
- OrderItem: {itemName: string, quantity: int, unitPrice: decimal}
- Order: {orderId: string, customerName: string, items: OrderItem[], totalAmount: decimal, status: string, createdAt: string}
- CreateOrderRequest: {customerName: string, items: OrderItem[]}
- UpdateOrderRequest: {customerName?: string, items?: OrderItem[], status?: string}
- ErrorResponse: {message: string, 'error: string}
