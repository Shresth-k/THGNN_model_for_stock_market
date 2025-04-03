export const dummyChartData = [
  { time: '2024-01-01', open: 150.23, high: 155.27, low: 149.85, close: 153.76 },
  { time: '2024-01-02', open: 153.76, high: 157.89, low: 152.54, close: 156.78 },
  { time: '2024-01-03', open: 156.78, high: 160.45, low: 155.90, close: 159.23 },
  { time: '2024-01-04', open: 159.23, high: 162.87, low: 158.34, close: 161.45 },
  { time: '2024-01-05', open: 161.45, high: 165.34, low: 160.78, close: 164.56 },
  { time: '2024-01-06', open: 164.56, high: 168.92, low: 163.21, close: 167.89 },
  { time: '2024-01-07', open: 167.89, high: 172.45, low: 166.54, close: 171.23 },
  { time: '2024-01-08', open: 171.23, high: 175.67, low: 170.12, close: 174.45 },
  { time: '2024-01-09', open: 174.45, high: 178.92, low: 173.34, close: 177.67 },
  { time: '2024-01-10', open: 177.67, high: 182.34, low: 176.45, close: 180.89 }
];

export const trainingLossData = Array.from({ length: 50 }, (_, i) => ({
  time: i + 1,
  value: 1 - Math.exp(-i / 20) + Math.random() * 0.1
}));

export const predictionData = dummyChartData.map(item => ({
  time: item.time,
  actual: item.close,
  predicted: item.close * (1 + (Math.random() * 0.1 - 0.05))
}));

export const priceDistributionData = Array.from({ length: 20 }, (_, i) => ({
  price: 150 + i * 2,
  frequency: Math.floor(Math.random() * 100)
}));