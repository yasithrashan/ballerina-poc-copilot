import ballerina/http;
import ballerina/io;

// Book record to represent book details
type Book record {
    int id;
    string title;
    string author;
    decimal price;
    int quantity;
};

// In-memory book repository
Book[] bookRepository = [];
int bookIdCounter = 1;

// Book management service
service / on new http:Listener(8080) {
    // Add a new book
    resource function post books(@http:Payload Book newBook) returns http:Created|http:BadRequest {
        // Validate book input
        if newBook.title == "" || newBook.author == "" || newBook.price <= 0 ) {
            return {body: "Invalid book details"};
        }

        // Assign a unique ID
        newBook.id = bookIdCounter;
        bookIdCounter += 1;

        // Add book to repository
        bookRepository.push(newBook);

        return <http:Created>{
            body: newBook,
            headers: {"Location": string `/books/${newBook.id}`}
        };
    }

    // Get all books
    resource function get books() returns Book[] {
        return bookRepository;
    }

    // Get a specific book by ID
    resource function get books/[int bookId]() returns Book|http:NotFound {
        Book? foundBook = bookRepository.find(book => book.id == bookId);

        if foundBook is Book {
            return foundBook;
        }

        return <http:NotFound>{
            body: string `Book with ID ${bookId} not found`
        };
    }

    // Update a book
    resource function put books/[int bookId](@http:Payload Book updatedBook) returns Book|http:NotFound|http:BadRequest {
        int? bookIndex = bookRepository.indexOf(book => book.id == bookId);

        if bookIndex is int {
            // Validate updated book details
            if updatedBook.title == "" || updatedBook.author == "" || updatedBook.price <= 0 ) {
                return {body: "Invalid book details"};
            }

            // Preserve the original book ID
            updatedBook.id = bookId;
            bookRepository[bookIndex] = updatedBook;

            return updatedBook;
        }

        return <http:NotFound>{
            body: string `Book with ID ${bookId} not found`
        };
    }

    // Delete a book
    resource function delete books/[int bookId]() returns http:Ok|http:NotFound {
        int? bookIndex = bookRepository.indexOf(book => book.id == bookId);

        if bookIndex is int {
            _ = bookRepository.remove(bookIndex);

            return <http:Ok>{
                body: string `Book with ID ${bookId} deleted successfully`
            };
        }

        return <http:NotFound>{
            body: string `Book with ID ${bookId} not found`
        };
    }
}
