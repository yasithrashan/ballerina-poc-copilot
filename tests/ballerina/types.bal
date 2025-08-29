// Book record type for database operations
public type Book record {|
    int id?;
    string title;
    string author;
    string isbn;
    decimal price;
    int quantity;
|};

// Book creation request (without id)
public type BookRequest record {|
    string title;
    string author;
    string isbn;
    decimal price;
    int quantity;
|};

// Error response type
public type ErrorResponse record {|
    string message;
|};

// Success response for operations
public type SuccessResponse record {|
    string message;
    string status;
|};
