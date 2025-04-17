# Test Coverage for Stalk Web

This directory contains tests for the Stalk Web application. The tests are written using Vitest and Vue Test Utils.

## Test Structure

The tests are organized by component:

- `src/__tests__/App.spec.ts`: Tests for the main App component
- `src/components/__tests__/MapComponent.spec.ts`: Tests for the MapComponent
- `src/views/__tests__/HomeView.spec.ts`: Tests for the HomeView component

## Running Tests

To run the tests, use the following command:

```bash
npm run test:unit
```

## Test Coverage

To run the tests with coverage, use the following command:

```bash
npm run test:coverage
```

This will generate a coverage report in the `coverage` directory.

## Adding New Tests

When adding new components to the application, follow these patterns to create corresponding test files:

1. Create a `__tests__` directory in the same directory as the component
2. Create a test file with the same name as the component, but with `.spec.ts` extension
3. Use the existing tests as a template for writing new tests

## Mocking Dependencies

For components that depend on external libraries (like Leaflet in MapComponent), use Vitest's mocking capabilities to mock the dependencies. See `MapComponent.spec.ts` for an example.
