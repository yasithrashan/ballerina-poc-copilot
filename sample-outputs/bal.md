# Ballerina Bookstore API Project
## This is the project summary of of the codebase

## Those are the Project Files
- `main.bal` - Main service implementation
- `types.bal` - Type definitions

---


## File Name: main.bal

### Imports
- `ballerina/http`
- `ballerina/sql`
- `ballerinax/mysql`

---

### Configurable Variables

* **Comments/DocComments**: Database configuration

- `dbHost` - string - `"localhost"`
- `dbUser` - string - `"root"`
- `dbPassword` - string - `""`
- `dbName` - string - `"bookstore"`
- `dbPort` - int - `3306`
- `servicePort` - int - `8080`

### Module Level Variables
- `dbClient` - mysql:Client

---

### Services
HTTP Service: `/bookstore` on port `servicePort 8080`

* **Comments/DocComments**: HTTP service for bookstore

---

### Endpoints

#### `bookstore/`

* **GET /books**
   * **Comments/DocComments**: Get all books
   * **Parameters**: none
   * **Returns**: `Book[]` or `ErrorResponse`
   * **Status Codes**:
     - `200 OK` - Successfully retrieved books
     - `500 Internal Server Error` - Database connection or query error

---

* **GET /books/{bookId}**
   * **Comments/DocComments**: Get book by ID
   * **Parameters**:
      * **Path Parameter**:
         * `bookId` - int - The unique identifier of the book
   * **Returns**: `Book` or `ErrorResponse`
   * **Status Codes**:
     - `200 OK` - Book found and retrieved successfully
     - `404 Not Found` - Book with specified ID does not exist
     - `500 Internal Server Error` - Database connection or query error

---

* **POST /books**
   * **Comments/DocComments**: Add new book
   * **Parameters**:
      * **Body / Payload Parameter**:
         * `bookRequest` - BookRequest - Book details to be created
   * **Returns**: `Book` (created) or `ErrorResponse`
   * **Status Codes**:
     - `201 Created` - Book successfully created
     - `400 Bad Request` - Invalid input data (empty fields, invalid price/quantity, duplicate ISBN)
     - `500 Internal Server Error` - Database connection or insertion error

---

* **PUT /books/{bookId}**
   * **Comments/DocComments**: Update book
   * **Parameters**:
      * **Path Parameter**:
         * `bookId` - int - The unique identifier of the book to update
      * **Body / Payload Parameter**:
         * `bookRequest` - BookRequest - Updated book details
   * **Returns**: `Book` (updated) or `ErrorResponse`
   * **Status Codes**:
     - `200 OK` - Book successfully updated
     - `400 Bad Request` - Invalid input data (empty fields, invalid price/quantity, duplicate ISBN)
     - `404 Not Found` - Book with specified ID does not exist
     - `500 Internal Server Error` - Database connection or update error

---

* **DELETE /books/{bookId}**
   * **Comments/DocComments**: Delete book
   * **Parameters**:
      * **Path Parameter**:
         * `bookId` - int - The unique identifier of the book to delete
   * **Returns**: `http:NoContent` or `ErrorResponse`
   * **Status Codes**:
     - `204 No Content` - Book successfully deleted
     - `404 Not Found` - Book with specified ID does not exist
     - `500 Internal Server Error` - Database connection or deletion error

---

* **GET /health**
   * **Comments/DocComments**: Health check endpoint
   * **Parameters**: none
   * **Returns**: `http:Ok`
   * **Status Codes**:
     - `200 OK` - Service is healthy and running

---

## File Name: types.bal

### Type Definitions

* **Book**
   * **Comments/DocComments**: Book record type for database operations
   * **Fields**:
      * `id?` - int (optional)
      * `title` - string
      * `author` - string
      * `isbn` - string
      * `price` - decimal
      * `quantity` - int

* **BookRequest**
   * **Comments/DocComments**: Book creation request (without id)
   * **Fields**:
      * `title` - string
      * `author` - string
      * `isbn` - string
      * `price` - decimal
      * `quantity` - int

* **ErrorResponse**
   * **Comments/DocComments**: Error response type
   * **Fields**:
      * `message` - string

* **SuccessResponse**
   * **Comments/DocComments**: Success response for operations
   * **Fields**:
      * `message` - string
      * `status` - string