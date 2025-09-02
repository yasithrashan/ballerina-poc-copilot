# Code Extract Report

**Search criteria:** Wishlist management feature including endpoints to add/remove products from wishlist and view wishlist items
**Files processed:** 2
**Generated:** 2025-09-01T18:33:11.149Z

---

File: types.bal

// New type definition for Wishlist
public type Wishlist record {|
    int wishlistId?;
    int customerId;
    int productId;
    time:Utc addedAt?;
|};

// New type definition for WishlistInput
public type WishlistInput record {|
    int customerId;
    int productId;
|};

File: main.bal

// New resource function to add product to wishlist
resource function post customers/[int customerId]/wishlist(@http:Header string? authorization, WishlistInput wishlistInput) returns ApiResponse|http:Unauthorized|http:BadRequest|http:InternalServerError {
    // Validate JWT token
    if authorization is () {
        return <http:Unauthorized>{body: {success: false, message: "Authorization header required"}};
    }

    string token = authorization.substring(7);
    jwt:Payload|error payload = validateJwtToken(token);

    if payload is error {
        return <http:Unauthorized>{body: {success: false, message: "Invalid token"}};
    }

    // Validate customer exists
    boolean customerExists = validateCustomer(customerId);
    if !customerExists {
        return <http:BadRequest>{
            body: {
                success: false,
                message: "Invalid customer ID"
            }
        };
    }

    // Validate product exists
    Product? product = getProductById(wishlistInput.productId);
    if product is () {
        return <http:BadRequest>{
            body: {
                success: false,
                message: "Invalid product ID"
            }
        };
    }

    time:Utc currentTime = time:utcNow();

    sql:ParameterizedQuery insertQuery = `
        INSERT INTO wishlists (customer_id, product_id, added_at)
        VALUES (${customerId}, ${wishlistInput.productId}, ${currentTime})
    `;

    sql:ExecutionResult|sql:Error result = dbClient->execute(insertQuery);

    if result is sql:Error {
        return <http:InternalServerError>{
            body: {
                success: false,
                message: "Failed to add product to wishlist"
            }
        };
    }

    return {
        success: true,
        message: "Product added to wishlist successfully",
        data: {wishlistId: result.lastInsertId}
    };
}

// New resource function to remove product from wishlist
resource function delete customers/[int customerId]/wishlist/[int productId](@http:Header string? authorization) returns ApiResponse|http:Unauthorized|http:NotFound|http:InternalServerError {
    // Validate JWT token
    if authorization is () {
        return <http:Unauthorized>{body: {success: false, message: "Authorization header required"}};
    }

    string token = authorization.substring(7);
    jwt:Payload|error payload = validateJwtToken(token);

    if payload is error {
        return <http:Unauthorized>{body: {success: false, message: "Invalid token"}};
    }

    sql:ParameterizedQuery deleteQuery = `
        DELETE FROM wishlists
        WHERE customer_id = ${customerId} AND product_id = ${productId}
    `;

    sql:ExecutionResult|sql:Error result = dbClient->execute(deleteQuery);

    if result is sql:Error {
        return <http:InternalServerError>{
            body: {
                success: false,
                message: "Failed to remove product from wishlist"
            }
        };
    }

    int? affectedRowCount = result.affectedRowCount;
    if affectedRowCount is () || affectedRowCount == 0 {
        return <http:NotFound>{
            body: {
                success: false,
                message: "Product not found in wishlist"
            }
        };
    }

    return {
        success: true,
        message: "Product removed from wishlist successfully"
    };
}

// New resource function to view wishlist items
resource function get customers/[int customerId]/wishlist(@http:Header string? authorization) returns ApiResponse|http:Unauthorized|http:InternalServerError {
    // Validate JWT token
    if authorization is () {
        return <http:Unauthorized>{body: {success: false, message: "Authorization header required"}};
    }

    string token = authorization.substring(7);
    jwt:Payload|error payload = validateJwtToken(token);

    if payload is error {
        return <http:Unauthorized>{body: {success: false, message: "Invalid token"}};
    }

    sql:ParameterizedQuery selectQuery = `
        SELECT w.wishlist_id, w.customer_id, w.product_id, w.added_at,
               p.product_name, p.description, p.price, p.stock_quantity
        FROM wishlists w
        JOIN products p ON w.product_id = p.product_id
        WHERE w.customer_id = ${customerId}
    `;

    stream<record {|Wishlist; string product_name; string description; decimal price; int stock_quantity;|}, sql:Error?> wishlistStream = dbClient->query(selectQuery);
    record {|Wishlist; string product_name; string description; decimal price; int stock_quantity;|}[]|error wishlistItems = from record {|Wishlist; string product_name; string description; decimal price; int stock_quantity;|} item in wishlistStream select item;

    if wishlistItems is error {
        return <http:InternalServerError>{
            body: {
                success: false,
                message: "Failed to retrieve wishlist items"
            }
        };
    }

    return {
        success: true,
        message: "Wishlist items retrieved successfully",
        data: wishlistItems
    };
}