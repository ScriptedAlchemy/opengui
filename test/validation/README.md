# Data Validation Tests

This directory contains comprehensive data validation tests for the OpenCode Web UI application. These tests ensure that all user inputs, API requests/responses, and data transformations are properly validated and sanitized.

## Test Files

### 1. `form-validation.test.ts`

Tests input validation for all forms in the application:

- **Chat Input Validation**: Message length, empty messages, special characters
- **Project Form Validation**: Name validation, path validation, required fields
- **Settings Form Validation**: AI configuration, environment variables, permissions
- **Real-time Validation**: Immediate feedback, character counting
- **Cross-field Validation**: Related field dependencies

### 2. `api-validation.test.ts`

Tests API request and response validation:

- **Request Payload Validation**: Required fields, type checking, format validation
- **Response Schema Validation**: Structure validation, type safety
- **Error Response Handling**: Malformed JSON, null responses, type mismatches
- **Security Validation**: Injection attempt handling, nested object validation
- **Schema Evolution**: Backward compatibility, additional fields

### 3. `data-conversion.test.ts`

Tests data type conversions and edge cases:

- **String to Number Conversion**: Valid numbers, scientific notation, edge cases
- **Boolean Conversion**: Truthy/falsy strings, case insensitivity
- **Date/Timestamp Handling**: Unix timestamps, invalid dates, edge values
- **JSON Parsing/Serialization**: Valid/invalid JSON, circular references
- **Array/String Conversions**: Delimiter handling, empty values
- **Performance Testing**: Large data sets, complex operations

### 4. `boundary-conditions.test.ts`

Tests boundary conditions and data sanitization:

- **Length Validation**: Minimum/maximum string lengths, array sizes
- **Range Validation**: Numeric ranges, floating point precision
- **HTML Sanitization**: XSS prevention, tag escaping, safe content preservation
- **Filename Sanitization**: Invalid character removal, length limits
- **Path Sanitization**: Traversal prevention, normalization
- **Security Detection**: SQL injection, XSS patterns, combination attacks

## Key Validation Areas

### Input Validation

- **Required vs Optional Fields**: Proper enforcement of required fields
- **Data Types**: String, number, boolean, array, object validation
- **Format Validation**: Email, URL, path, filename formats
- **Length Constraints**: Minimum and maximum length enforcement
- **Character Sets**: Unicode support, special character handling

### Boundary Testing

- **Minimum Values**: Zero, negative numbers, empty strings/arrays
- **Maximum Values**: Large numbers, long strings, large arrays
- **Edge Cases**: Infinity, NaN, null, undefined handling
- **Performance Limits**: Large data processing, timeout handling

### Security Validation

- **XSS Prevention**: Script tag detection, event handler filtering
- **SQL Injection**: Keyword detection, pattern matching
- **Path Traversal**: Directory traversal prevention
- **HTML Sanitization**: Safe HTML rendering, entity encoding
- **Input Sanitization**: Malicious content filtering

### Data Integrity

- **Type Safety**: Runtime type checking, conversion validation
- **Schema Validation**: API request/response structure validation
- **Data Consistency**: Cross-field validation, business rule enforcement
- **Error Handling**: Graceful degradation, user-friendly error messages

## Test Patterns

### Validation Function Testing

```typescript
// Test valid inputs
expect(validator.validate(validInput)).toEqual({ valid: true })

// Test invalid inputs
expect(validator.validate(invalidInput)).toEqual({
  valid: false,
  error: "Expected error message",
})

// Test edge cases
expect(validator.validate(edgeCase)).toBeDefined()
```

### Boundary Value Testing

```typescript
// Test minimum boundary
expect(validator.validateRange(minValue, min, max)).toEqual({ valid: true })

// Test maximum boundary
expect(validator.validateRange(maxValue, min, max)).toEqual({ valid: true })

// Test below minimum
expect(validator.validateRange(belowMin, min, max)).toEqual({ valid: false })

// Test above maximum
expect(validator.validateRange(aboveMax, min, max)).toEqual({ valid: false })
```

### Security Testing

```typescript
// Test XSS attempts
const xssInput = "<script>alert('xss')</script>"
expect(sanitizer.sanitizeHtml(xssInput)).not.toContain("<script>")

// Test SQL injection attempts
const sqlInput = "'; DROP TABLE users; --"
expect(detector.detectSqlInjection(sqlInput)).toBe(true)
```

## Running the Tests

```bash
# Run all validation tests
bun test test/validation/

# Run specific test file
bun test test/validation/form-validation.test.ts

# Run with coverage
bun test test/validation/ --coverage

# Run in watch mode
bun test test/validation/ --watch
```

## Test Coverage Goals

- **Form Validation**: 100% coverage of all form inputs
- **API Validation**: 100% coverage of all API endpoints
- **Data Conversion**: 95% coverage including edge cases
- **Security Validation**: 100% coverage of security patterns
- **Boundary Conditions**: 90% coverage of boundary scenarios

## Best Practices

### Test Organization

- Group related tests in describe blocks
- Use descriptive test names that explain the scenario
- Test both positive and negative cases
- Include edge cases and boundary conditions

### Validation Logic

- Validate early and fail fast
- Provide clear, actionable error messages
- Handle null/undefined inputs gracefully
- Sanitize inputs before processing

### Security Considerations

- Always sanitize user inputs
- Validate on both client and server side
- Use whitelist validation when possible
- Log security violations for monitoring

### Performance

- Test with large data sets
- Validate performance under load
- Use efficient validation algorithms
- Cache validation results when appropriate

## Common Validation Patterns

### Required Field Validation

```typescript
if (!value || (typeof value === "string" && value.trim().length === 0)) {
  return { valid: false, error: "Field is required" }
}
```

### Length Validation

```typescript
if (value.length < min || value.length > max) {
  return { valid: false, error: `Length must be between ${min} and ${max}` }
}
```

### Type Validation

```typescript
if (typeof value !== expectedType) {
  return { valid: false, error: `Expected ${expectedType}, got ${typeof value}` }
}
```

### Format Validation

```typescript
if (!pattern.test(value)) {
  return { valid: false, error: "Invalid format" }
}
```

## Integration with Application

These validation tests ensure that:

- User inputs are properly validated before processing
- API requests/responses conform to expected schemas
- Data transformations preserve integrity
- Security vulnerabilities are prevented
- Performance remains acceptable under various conditions

The validation logic tested here should be integrated into:

- Form components for real-time validation
- API middleware for request/response validation
- Data transformation utilities
- Security middleware for input sanitization
- Error handling systems for graceful degradation
