import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

interface BarChartProps {
  data: any[];
  height: number;
  stockSymbol: string;
}

export const VolumeChart: React.FC<BarChartProps> = ({ data, height, stockSymbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Clear any existing chart
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: '#1E1E30' },
        textColor: '#DDD',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
    });

    // Create the volume series
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: '',
    });

    // Format data for the volume chart
    const volumeData = data.map(item => ({
      time: item.date,
      value: item.volume,
      color: item.isUp ? '#26a69a' : '#ef5350', // Green for up days, red for down days
    }));

    volumeSeries.setData(volumeData);

    // Fit content to view - show the most recent 30 days by default
    chart.timeScale().fitContent();
    if (data.length > 30) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, data.length - 30),
        to: data.length
      });
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height, stockSymbol]);

  return (
    <div className="w-full" ref={chartContainerRef} />
  );
};

export const PriceRangeChart: React.FC<BarChartProps> = ({ data, height, stockSymbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Clear any existing chart
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      height,
      layout: {
        background: { color: '#1E1E30' },
        textColor: '#DDD',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: '#2B2B43' },
        horzLines: { color: '#2B2B43' },
      },
      timeScale: {
        borderColor: '#2B2B43',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#2B2B43',
      },
    });

    // Create the price range series
    const priceRangeSeries = chart.addHistogramSeries({
      color: '#4B5563',
      priceFormat: {
        type: 'price',
        precision: 2,
      },
    });

    // Format data for the price range chart
    const priceRangeData = data.map(item => ({
      time: item.date,
      value: item.priceRange,
      color: item.isUp ? '#26a69a' : '#ef5350', // Green for up days, red for down days
    }));

    priceRangeSeries.setData(priceRangeData);

    // Fit content to view - show the most recent 30 days by default
    chart.timeScale().fitContent();
    if (data.length > 30) {
      chart.timeScale().setVisibleLogicalRange({
        from: Math.max(0, data.length - 30),
        to: data.length
      });
    }

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ 
          width: chartContainerRef.current.clientWidth 
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data, height, stockSymbol]);

  return (
    <div className="w-full" ref={chartContainerRef} />
  );
};