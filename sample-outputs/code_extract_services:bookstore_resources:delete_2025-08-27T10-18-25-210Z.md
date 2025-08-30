# Code Extract Report

**Search criteria:** services:bookstore; resources:delete
**Files processed:** 2
**Generated:** 2025-08-27T10:18:25.208Z

---

### File: main.bal

#### Imports
```ballerina
import ballerina/http;
```

#### Variable: bookstore
```ballerina
map<Book> bookStore = {};
```

#### Resource Function: delete
```ballerina
    // Delete a specific book
    resource function delete books/[string bookId]() returns http:NoContent|http:NotFound|error {
        if !bookStore.hasKey(k = bookId) {
            return http:NOT_FOUND;
        }
        Book removedBook = bookStore.remove(k = bookId);
        return http:NO_CONTENT;
    }

    // Delete all books
    resource function delete books() returns http:NoContent|http:NotFound|error {
        int bookCount = bookStore.length();
        if bookCount == 0 {
            return http:NOT_FOUND;
        }
        bookStore.removeAll();
        return http:NO_CONTENT;
    }
```

No matching symbols found in this file. The symbols "bookstore" and "delete" do not appear in the provided Ballerina code file.

The file contains several type definitions and records related to a book management system, including Book, Author, Category, BookStatus, and various response types, but neither "bookstore" nor "delete" are present.

