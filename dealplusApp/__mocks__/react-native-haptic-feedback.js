module.exports = {
  __esModule: true,
  default: {
    trigger: jest.fn(),
    triggerPattern: jest.fn(),
    stop: jest.fn(),
    isSupported: jest.fn(() => true),
    isEnabled: jest.fn(() => true),
    setEnabled: jest.fn(),
  },
};
