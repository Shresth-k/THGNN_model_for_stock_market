import React, { useEffect, useRef } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface AreaChartProps {
  data: any[];
  height: number;
  stockSymbol: string;
  type: 'price' | 'volume' | 'rsi' | 'macd';
  title: string;
}

const AreaChart: React.FC<AreaChartProps> = ({ data, height, stockSymbol, type, title }) => {
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

    // Create the area series
    const areaSeries = chart.addAreaSeries({
      topColor: getTopColor(type),
      bottomColor: getBottomColor(type),
      lineColor: getLineColor(type),
      lineWidth: 2,
    });

    // Format data for the area chart
    const areaData = data.map(item => ({
      time: item.date,
      value: getValueByType(item, type),
    }));

    areaSeries.setData(areaData);

    // Add special markers for RSI overbought/oversold or MACD crossovers
    if (type === 'rsi') {
      // Add horizontal lines for overbought (70) and oversold (30) levels
      const overboughtLine = chart.addLineSeries({
        color: '#ef5350',
        lineWidth: 1,
        lineStyle: 2, // Dashed line
      });
      
      const oversoldLine = chart.addLineSeries({
        color: '#26a69a',
        lineWidth: 1,
        lineStyle: 2, // Dashed line
      });
      
      overboughtLine.setData(data.map(item => ({
        time: item.date,
        value: 70,
      })));
      
      oversoldLine.setData(data.map(item => ({
        time: item.date,
        value: 30,
      })));
    } else if (type === 'macd') {
      // Add a line for the signal line
      const signalSeries = chart.addLineSeries({
        color: '#f48fb1',
        lineWidth: 1,
      });
      
      signalSeries.setData(data.map(item => ({
        time: item.date,
        value: item.signal_line,
      })));
    }

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
  }, [data, height, stockSymbol, type]);

  // Helper functions for chart styling
  const getTopColor = (type: string): string => {
    switch (type) {
      case 'price':
        return 'rgba(38, 166, 154, 0.4)';
      case 'volume':
        return 'rgba(76, 175, 229, 0.4)';
      case 'rsi':
        return 'rgba(239, 83, 80, 0.4)';
      case 'macd':
        return 'rgba(255, 152, 0, 0.4)';
      default:
        return 'rgba(38, 166, 154, 0.4)';
    }
  };

  const getBottomColor = (type: string): string => {
    switch (type) {
      case 'price':
        return 'rgba(38, 166, 154, 0.0)';
      case 'volume':
        return 'rgba(76, 175, 229, 0.0)';
      case 'rsi':
        return 'rgba(239, 83, 80, 0.0)';
      case 'macd':
        return 'rgba(255, 152, 0, 0.0)';
      default:
        return 'rgba(38, 166, 154, 0.0)';
    }
  };

  const getLineColor = (type: string): string => {
    switch (type) {
      case 'price':
        return '#26a69a';
      case 'volume':
        return '#4cafef';
      case 'rsi':
        return '#ef5350';
      case 'macd':
        return '#ff9800';
      default:
        return '#26a69a';
    }
  };

  const getValueByType = (item: any, type: string): number => {
    switch (type) {
      case 'price':
        return item.close;
      case 'volume':
        return item.volume;
      case 'rsi':
        return item.rsi;
      case 'macd':
        return item.macd;
      default:
        return item.close;
    }
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="w-full" ref={chartContainerRef} />
    </div>
  );
};

export default AreaChart;