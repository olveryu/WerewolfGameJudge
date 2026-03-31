const toast = Object.assign(jest.fn(), {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
  custom: jest.fn(),
  promise: jest.fn(),
});

const Toaster = () => null;

export { toast, Toaster };
