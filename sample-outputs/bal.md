# Ballerina Bookstore API Project

## main.bal

### Imports
- `ballerina/http`

### Module Level Variables
- `map<Book> bookStore`
- `map<Author> authorStore`
- `map<Category> categoryStore`

### Services
- HTTP Service: `/bookstore` on port 8080

### Resources
#### Books Endpoint
- `GET /books`: Retrieve books with optional filtering
  - Parameters: `title`, `author`, `category`, `minPrice`, `maxPrice`, `status`
  - Returns: `BooksResponse`

- `GET /books/{bookId}`: Retrieve a specific book
  - Returns: `BookResponse` or `http:NotFound`

- `POST /books`: Add a new book
  - Validates book, author, and category
  - Returns: `http:Created` or `http:BadRequest`

- `PUT /books/{bookId}`: Update an existing book
  - Validates book, author, and category
  - Returns: `BookResponse` or `http:NotFound`/`http:BadRequest`

- `DELETE /books/{bookId}`: Delete a specific book
  - Returns: `http:NoContent` or `http:NotFound`

- `DELETE /books`: Delete all books
  - Returns: `http:NoContent` or `http:NotFound`

#### Categories Endpoint
- `GET /categories`: Retrieve all categories
  - Returns: `CategoriesResponse`

- `POST /categories`: Add a new category
  - Validates category and optional parent category
  - Returns: `http:Created` or `http:BadRequest`

#### Authors Endpoint
- `GET /authors`: Retrieve all authors
  - Returns: `AuthorsResponse`

#### Inventory Endpoint
- `POST /inventory/bulk`: Bulk update book inventory
  - Updates book quantity and status
  - Returns: `BulkUpdateResponse`

## types.bal

### Types
#### Record Types
- `Book`: Represents book details with ID, title, author, category, etc.
- `Author`: Represents author information
- `Category`: Represents book category with optional parent category
- `BookSearchCriteria`: Search parameters for books
- `BulkInventoryUpdate`: Bulk inventory update request
- `InventoryItem`: Individual inventory update item

#### Response Types
- `BookResponse`
- `BooksResponse`
- `CategoryResponse`
- `CategoriesResponse`
- `AuthorResponse`
- `AuthorsResponse`
- `BulkUpdateResponse`
- `ErrorResponse`

#### Enumerations
- `BookStatus`: `AVAILABLE`, `OUT_OF_STOCK`, `DISCONTINUED`