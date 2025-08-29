import ballerina/http;
import ballerina/sql;
import ballerinax/mysql;

// Database configuration
configurable string dbHost = "localhost";
configurable string dbUser = "root";
configurable string dbPassword = "";
configurable string dbName = "bookstore";
configurable int dbPort = 3306;

// HTTP service configuration
configurable int servicePort = 8080;

// Initialize MySQL client
final mysql:Client dbClient = check new (
    host = dbHost,
    user = dbUser,
    password = dbPassword,
    database = dbName,
    port = dbPort
);

// HTTP service for bookstore
service /bookstore on new http:Listener(servicePort) {

    // Get all books
    resource function get books() returns Book[]|http:InternalServerError {
        sql:ParameterizedQuery query = `SELECT id, title, author, isbn, price, quantity FROM books`;

        stream<Book, sql:Error?> bookStream = dbClient->query(query);
        Book[] books = [];

        error? result = bookStream.forEach(function(Book book) {
            books.push(book);
        });

        if result is error {
            http:InternalServerError errorResponse = {
                body: {
                    message: "Failed to retrieve books from database"
                }
            };
            return errorResponse;
        }

        return books;
    }

    // Get book by ID
    resource function get books/[int bookId]() returns Book|http:NotFound|http:InternalServerError {
        sql:ParameterizedQuery query = `SELECT id, title, author, isbn, price, quantity FROM books WHERE id = ${bookId}`;

        Book|sql:Error result = dbClient->queryRow(query);

        if result is sql:Error {
            if result.message().includes("No rows") {
                http:NotFound notFoundResponse = {
                    body: {
                        message: "Book not found"
                    }
                };
                return notFoundResponse;
            }
            http:InternalServerError errorResponse = {
                body: {
                    message: "Database error occurred"
                }
            };
            return errorResponse;
        }

        return result;
    }

    // Add new book
    resource function post books(@http:Payload BookRequest bookRequest) returns http:Created|http:BadRequest|http:InternalServerError {
        // Validate input
        if bookRequest.title.trim() == "" || bookRequest.author.trim() == "" || bookRequest.isbn.trim() == "" {
            http:BadRequest badRequestResponse = {
                body: {
                    message: "Title, author, and ISBN cannot be empty"
                }
            };
            return badRequestResponse;
        }

        if bookRequest.price <= 0.0d || bookRequest.quantity < 0 {
            http:BadRequest badRequestResponse = {
                body: {
                    message: "Price must be positive and quantity cannot be negative"
                }
            };
            return badRequestResponse;
        }

        sql:ParameterizedQuery insertQuery = `INSERT INTO books (title, author, isbn, price, quantity)
                                            VALUES (${bookRequest.title}, ${bookRequest.author},
                                                   ${bookRequest.isbn}, ${bookRequest.price}, ${bookRequest.quantity})`;

        sql:ExecutionResult|sql:Error result = dbClient->execute(insertQuery);

        if result is sql:Error {
            if result.message().includes("Duplicate entry") {
                http:BadRequest badRequestResponse = {
                    body: {
                        message: "A book with this ISBN already exists"
                    }
                };
                return badRequestResponse;
            }
            http:InternalServerError errorResponse = {
                body: {
                    message: "Failed to add book"
                }
            };
            return errorResponse;
        }

        // Get the inserted book ID
        string|int? lastInsertId = result.lastInsertId;
        if lastInsertId is int {
            // Retrieve the newly created book
            sql:ParameterizedQuery selectQuery = `SELECT id, title, author, isbn, price, quantity FROM books WHERE id = ${lastInsertId}`;
            Book|sql:Error newBook = dbClient->queryRow(selectQuery);

            if newBook is Book {
                http:Created createdResponse = {
                    body: newBook
                };
                return createdResponse;
            }
        }

        http:InternalServerError errorResponse = {
            body: {
                message: "Book creation failed"
            }
        };
        return errorResponse;
    }

    // Update book
    resource function put books/[int bookId](@http:Payload BookRequest bookRequest) returns Book|http:NotFound|http:BadRequest|http:InternalServerError {
        // Validate input
        if bookRequest.title.trim() == "" || bookRequest.author.trim() == "" || bookRequest.isbn.trim() == "" {
            http:BadRequest badRequestResponse = {
                body: {
                    message: "Title, author, and ISBN cannot be empty"
                }
            };
            return badRequestResponse;
        }

        if bookRequest.price <= 0.0d || bookRequest.quantity < 0 {
            http:BadRequest badRequestResponse = {
                body: {
                    message: "Price must be positive and quantity cannot be negative"
                }
            };
            return badRequestResponse;
        }

        sql:ParameterizedQuery updateQuery = `UPDATE books SET title = ${bookRequest.title},
                                            author = ${bookRequest.author}, isbn = ${bookRequest.isbn},
                                            price = ${bookRequest.price}, quantity = ${bookRequest.quantity}
                                            WHERE id = ${bookId}`;

        sql:ExecutionResult|sql:Error result = dbClient->execute(updateQuery);

        if result is sql:Error {
            if result.message().includes("Duplicate entry") {
                http:BadRequest badRequestResponse = {
                    body: {
                        message: "Another book with this ISBN already exists"
                    }
                };
                return badRequestResponse;
            }
            http:InternalServerError errorResponse = {
                body: {
                    message: "Failed to update book"
                }
            };
            return errorResponse;
        }

        int? affectedRowCount = result.affectedRowCount;
        if affectedRowCount == 0 {
            http:NotFound notFoundResponse = {
                body: {
                    message: "Book not found"
                }
            };
            return notFoundResponse;
        }

        // Retrieve the updated book
        sql:ParameterizedQuery selectQuery = `SELECT id, title, author, isbn, price, quantity FROM books WHERE id = ${bookId}`;
        Book|sql:Error updatedBook = dbClient->queryRow(selectQuery);

        if updatedBook is Book {
            return updatedBook;
        }

        http:InternalServerError errorResponse = {
            body: {
                message: "Update verification failed"
            }
        };
        return errorResponse;
    }

    // Delete book
    resource function delete books/[int bookId]() returns http:NoContent|http:NotFound|http:InternalServerError {
        sql:ParameterizedQuery deleteQuery = `DELETE FROM books WHERE id = ${bookId}`;

        sql:ExecutionResult|sql:Error result = dbClient->execute(deleteQuery);

        if result is sql:Error {
            http:InternalServerError errorResponse = {
                body: {
                    message: "Failed to delete book"
                }
            };
            return errorResponse;
        }

        int? affectedRowCount = result.affectedRowCount;
        if affectedRowCount == 0 {
            http:NotFound notFoundResponse = {
                body: {
                    message: "Book not found"
                }
            };
            return notFoundResponse;
        }

        http:NoContent noContentResponse = {};
        return noContentResponse;
    }

    // Health check endpoint
    resource function get health() returns http:Ok {
        http:Ok okResponse = {
            body: {
                message: "Service is healthy",
                status: "UP"
            }
        };
        return okResponse;
    }
}
