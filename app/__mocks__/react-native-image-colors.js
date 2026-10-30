// Native module — return a fixed palette in Jest.
module.exports = {
  getColors: jest.fn(async () => ({
    platform: 'android',
    dominant: '#F5CB1B',
    average: '#F5CB1B',
    vibrant: '#F5CB1B',
    darkVibrant: '#D97706',
    lightVibrant: '#FDE68A',
    darkMuted: '#78716C',
    lightMuted: '#F5F5F4',
    muted: '#A8A29E',
  })),
  cache: { getItem: () => undefined, setItem: () => {}, removeItem: () => {}, clear: () => {} },
  default: { getColors: jest.fn(async () => ({ platform: 'android', vibrant: '#F5CB1B', dominant: '#F5CB1B' })) },
};
