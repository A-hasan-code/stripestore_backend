const ErrorHandler = require("../utils/ErrorHandler");

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.message = err.message || "Internal Server Error";

    // MySQL Error Handling
    switch (err.code) {
        case 'ER_DUP_ENTRY':
            err = new ErrorHandler("Duplicate entry error: " + err.sqlMessage, 400);
            break;

        case 'ER_NO_SUCH_TABLE':
            err = new ErrorHandler("The requested resource does not exist.", 404);
            break;

        case 'ER_PARSE_ERROR':
            err = new ErrorHandler("There was a syntax error in your SQL query.", 400);
            break;

        case 'ER_ACCESS_DENIED_ERROR':
            err = new ErrorHandler("Access denied for user.", 403);
            break;

        case 'ER_BAD_DB_ERROR':
            err = new ErrorHandler("Database does not exist.", 404);
            break;

        case 'ER_BAD_FIELD_ERROR':
            err = new ErrorHandler("Unknown column in the field list.", 400);
            break;

        case 'ER_NO_REFERENCED_ROW_2':
            err = new ErrorHandler("Foreign key constraint fails: referenced row not found.", 400);
            break;

        case 'ER_ROW_IS_REFERENCED_2':
            err = new ErrorHandler("Foreign key constraint fails: cannot delete or update a parent row.", 400);
            break;

        case 'ER_SYNTAX_ERROR':
            err = new ErrorHandler("Syntax error in the SQL statement.", 400);
            break;

        case 'ER_TIMEOUT':
            err = new ErrorHandler("Database operation timed out.", 503);
            break;

        // Connection errors
        case 'ECONNREFUSED':
            err = new ErrorHandler("Database connection was refused.", 503);
            break;

        case 'PROTOCOL_CONNECTION_LOST':
            err = new ErrorHandler("Database connection was closed.", 503);
            break;

        // JWT errors
        case 'JsonWebTokenError':
            err = new ErrorHandler("Your token is invalid, please try again later.", 401);
            break;

        case 'TokenExpiredError':
            err = new ErrorHandler("Your token has expired, please try again later!", 401);
            break;

        // Handle other common HTTP errors
        case 404:
            err.message = "Resource not found";
            break;

        case 403:
            err.message = "Access forbidden";
            break;

        // Handle internal server errors
        default:
            console.error(err); // Log the error for debugging
            res.status(err.statusCode).json({
                success: false,
                message: err.message,
            });
            return; // Exit to avoid sending multiple responses
    }

    // Final error response
    res.status(err.statusCode).json({
        success: false,
        message: err.message,
    });
};
