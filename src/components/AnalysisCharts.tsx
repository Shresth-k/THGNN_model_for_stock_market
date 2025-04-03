import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface ChartProps {
  containerId: string;
  height?: number;
}

const createBaseChart = (container: HTMLElement, height: number = 300) => {
  return createChart(container, {
    height,
    layout: {
      background: { color: '#1F2937' },
      textColor: '#D1D5DB',
    },
    grid: {
      vertLines: { color: '#374151' },
      horzLines: { color: '#374151' },
    },
    rightPriceScale: {
      borderColor: '#374151',
    },
    timeScale: {
      borderColor: '#374151',
    },
  });
};

export const LossChart: React.FC<ChartProps> = ({ containerId, height = 300 }) => {
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (container) {
      const chart = createBaseChart(container, height);
      const lineSeries = chart.addLineSeries({
        color: '#60A5FA',
        lineWidth: 2,
      });
      
      lineSeries.setData(Array.from({ length: 50 }, (_, i) => ({
        time: i + 1,
        value: 1 - Math.exp(-i / 20) + Math.random() * 0.1
      })));

      chartRef.current = chart;

      return () => {
        chart.remove();
      };
    }
  }, [containerId, height]);

  return <div id={containerId} />;
};

export const PredictionChart: React.FC<ChartProps> = ({ containerId, height = 300 }) => {
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (container) {
      const chart = createBaseChart(container, height);
      
      const actualSeries = chart.addLineSeries({
        color: '#34D399',
        lineWidth: 2,
        title: 'Actual',
      });

      const predictedSeries = chart.addLineSeries({
        color: '#F87171',
        lineWidth: 2,
        title: 'Predicted',
      });

      const data = Array.from({ length: 10 }, (_, i) => {
        const baseValue = 150 + i * 3;
        return {
          time: i + 1,
          actualValue: baseValue,
          predictedValue: baseValue * (1 + (Math.random() * 0.1 - 0.05))
        };
      });

      actualSeries.setData(data.map(d => ({ time: d.time, value: d.actualValue })));
      predictedSeries.setData(data.map(d => ({ time: d.time, value: d.predictedValue })));

      chartRef.current = chart;

      return () => {
        chart.remove();
      };
    }
  }, [containerId, height]);

  return <div id={containerId} />;
};

export const PriceDistributionChart: React.FC<ChartProps> = ({ containerId, height = 300 }) => {
  const chartRef = useRef<any>(null);

  useEffect(() => {
    const container = document.getElementById(containerId);
    if (container) {
      const chart = createBaseChart(container, height);
      
      const histogramSeries = chart.addHistogramSeries({
        color: '#818CF8',
        base: 0,
      });

      const data = Array.from({ length: 20 }, (_, i) => ({
        time: 150 + i * 2,
        value: Math.floor(Math.random() * 100)
      }));

      histogramSeries.setData(data);

      chartRef.current = chart;

      return () => {
        chart.remove();
      };
    }
  }, [containerId, height]);

  return <div id={containerId} />;
};