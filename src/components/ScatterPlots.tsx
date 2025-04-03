import React, { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

interface ScatterPlotProps {
  data: any[];
  height: number;
  stockSymbol: string;
  type: 'volatility' | 'correlation';
}

const ScatterPlot: React.FC<ScatterPlotProps> = ({ data, height, stockSymbol, type }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    // Clear any existing chart
    chartContainerRef.current.innerHTML = '';

    // Use up to 2 years of data (approximately 500 trading days)
    const chartData = data.slice(-500);

    if (type === 'volatility') {
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
        rightPriceScale: {
          borderColor: '#2B2B43',
          autoScale: true,
        },
        timeScale: {
          borderColor: '#2B2B43',
          timeVisible: true,
          secondsVisible: false,
          // Enable zooming and scrolling
          barSpacing: 6, // Compact initial view
          minBarSpacing: 2, // Allow zooming in very close
        },
        // Enable mouse interactions
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
        },
        handleScale: {
          axisPressedMouseMove: true,
          mouseWheel: true,
          pinch: true,
        },
      });

      // Calculate daily percentage changes
      const percentageChanges = chartData.map(item => {
        const percentChange = ((item.close - item.open) / item.open) * 100;
        return {
          time: item.date,
          value: percentChange,
          color: percentChange >= 0 ? '#4CAF50' : '#FF5252',
        };
      });

      // Create a scatter series for volatility
      const scatterSeries = chart.addLineSeries({
        color: '#4CAF50',
        lineWidth: 1.5, // Thinner line for better visibility with more data
        title: 'Daily Percentage Change',
        lastValueVisible: false,
      });

      scatterSeries.setData(percentageChanges);

      // Add a zero line for reference
      const zeroLine = chart.addLineSeries({
        color: '#888',
        lineWidth: 1,
        lineStyle: 2, // Dashed line
        title: 'Zero Line',
        lastValueVisible: false,
      });

      zeroLine.setData(chartData.map(item => ({
        time: item.date,
        value: 0
      })));

      chart.applyOptions({
        rightPriceScale: {
          scaleMargins: {
            top: 0.2,
            bottom: 0.2,
          },
        },
      });

      // Remove the zoom instructions element
      // const instructionsElement = document.createElement('div');
      // instructionsElement.style.position = 'absolute';
      // instructionsElement.style.top = '10px';
      // instructionsElement.style.right = '10px';
      // instructionsElement.style.fontSize = '12px';
      // instructionsElement.style.color = '#AAA';
      // instructionsElement.style.backgroundColor = 'rgba(30, 30, 48, 0.8)';
      // instructionsElement.style.padding = '5px';
      // instructionsElement.style.borderRadius = '4px';
      // instructionsElement.style.zIndex = '1000';
      // instructionsElement.innerHTML = 'Use mouse wheel to zoom, drag to pan';
      // chartContainerRef.current.style.position = 'relative';
      // chartContainerRef.current.appendChild(instructionsElement);

      // Set chart title
      const titleElement = document.createElement('div');
      titleElement.style.textAlign = 'center';
      titleElement.style.fontSize = '16px';
      titleElement.style.fontWeight = 'bold';
      titleElement.style.marginBottom = '10px';
      titleElement.innerText = `Daily Percentage Changes - ${stockSymbol} (2 Year History)`;
      chartContainerRef.current.prepend(titleElement);

      // Fit all content initially
      chart.timeScale().fitContent();

    } else if (type === 'correlation') {
      // Create a container for our custom scatter plot
      const scatterContainer = document.createElement('div');
      scatterContainer.style.width = '100%';
      scatterContainer.style.height = `${height}px`;
      scatterContainer.style.position = 'relative';
      scatterContainer.style.backgroundColor = '#1E1E30';
      chartContainerRef.current.appendChild(scatterContainer);

      // Set chart title
      const titleElement = document.createElement('div');
      titleElement.style.textAlign = 'center';
      titleElement.style.fontSize = '16px';
      titleElement.style.fontWeight = 'bold';
      titleElement.style.padding = '10px';
      titleElement.style.color = '#DDD';
      titleElement.innerText = `Volume vs Price Change Correlation - ${stockSymbol} (Last 180 Days)`;
      scatterContainer.appendChild(titleElement);

      // Calculate max volume for scaling
      const maxVolume = Math.max(...chartData.map(item => item.volume));
      
      // Calculate max absolute percentage change for scaling
      const percentageChanges = chartData.map(item => 
        ((item.close - item.open) / item.open) * 100
      );
      const maxPercentChange = Math.max(
        Math.abs(Math.min(...percentageChanges)),
        Math.max(...percentageChanges)
      );

      // Create axes container with more space for labels
      const axesContainer = document.createElement('div');
      axesContainer.style.position = 'absolute';
      axesContainer.style.left = '60px'; // Increased from 40px
      axesContainer.style.right = '30px'; // Increased from 20px
      axesContainer.style.top = '50px'; // Increased from 40px
      axesContainer.style.bottom = '50px'; // Increased from 40px
      axesContainer.style.borderLeft = '1px solid #555';
      axesContainer.style.borderBottom = '1px solid #555';
      scatterContainer.appendChild(axesContainer);

      // Add horizontal zero line
      const zeroLine = document.createElement('div');
      zeroLine.style.position = 'absolute';
      zeroLine.style.left = '0';
      zeroLine.style.right = '0';
      zeroLine.style.top = '50%';
      zeroLine.style.borderTop = '1px dashed #555';
      axesContainer.appendChild(zeroLine);

      // Add points with smaller size for better visibility with more data points
      chartData.forEach(item => {
        const percentChange = ((item.close - item.open) / item.open) * 100;
        const isPositive = percentChange >= 0;
        
        const point = document.createElement('div');
        point.style.position = 'absolute';
        point.style.width = '6px'; // Reduced from 8px
        point.style.height = '6px'; // Reduced from 8px
        point.style.borderRadius = '50%';
        point.style.backgroundColor = isPositive ? '#4CAF50' : '#FF5252';
        
        // Position based on volume (x) and percentage change (y)
        const xPos = (item.volume / maxVolume) * 100;
        const yPos = 50 - (percentChange / maxPercentChange) * 45; // 45% to leave some margin
        
        point.style.left = `${xPos}%`;
        point.style.top = `${yPos}%`;
        point.style.transform = 'translate(-50%, -50%)';
        
        // Add tooltip
        point.title = `Date: ${item.date}\nVolume: ${item.volume.toLocaleString()}\nChange: ${percentChange.toFixed(2)}%`;
        
        axesContainer.appendChild(point);
      });

      // Add axis labels with better positioning
      const xAxisLabel = document.createElement('div');
      xAxisLabel.style.position = 'absolute';
      xAxisLabel.style.bottom = '-35px'; // Moved further down
      xAxisLabel.style.left = '50%';
      xAxisLabel.style.transform = 'translateX(-50%)';
      xAxisLabel.style.color = '#AAA';
      xAxisLabel.innerText = 'Volume';
      axesContainer.appendChild(xAxisLabel);

      const yAxisLabel = document.createElement('div');
      yAxisLabel.style.position = 'absolute';
      yAxisLabel.style.left = '-45px'; // Moved further left
      yAxisLabel.style.top = '50%';
      yAxisLabel.style.transform = 'translateY(-50%) rotate(-90deg)';
      yAxisLabel.style.color = '#AAA';
      yAxisLabel.innerText = 'Price Change %';
      axesContainer.appendChild(yAxisLabel);

      // Add volume scale markers
      [0, 25, 50, 75, 100].forEach(percent => {
        const marker = document.createElement('div');
        marker.style.position = 'absolute';
        marker.style.bottom = '-20px';
        marker.style.left = `${percent}%`;
        marker.style.transform = 'translateX(-50%)';
        marker.style.color = '#888';
        marker.style.fontSize = '10px';
        
        // Format volume value based on percentage of max
        const volumeValue = (percent / 100) * maxVolume;
        marker.innerText = formatVolume(volumeValue);
        
        axesContainer.appendChild(marker);
      });

      // Add percentage change scale markers
      [-100, -50, 0, 50, 100].forEach(percent => {
        const scaledPercent = percent / 100 * maxPercentChange;
        const yPos = 50 - (scaledPercent / maxPercentChange) * 45;
        
        if (yPos >= 0 && yPos <= 100) { // Only add if within bounds
          const marker = document.createElement('div');
          marker.style.position = 'absolute';
          marker.style.left = '-30px';
          marker.style.top = `${yPos}%`;
          marker.style.transform = 'translateY(-50%)';
          marker.style.color = '#888';
          marker.style.fontSize = '10px';
          marker.innerText = `${scaledPercent.toFixed(1)}%`;
          
          axesContainer.appendChild(marker);
        }
      });

      // Add legend with better positioning
      const legend = document.createElement('div');
      legend.style.position = 'absolute';
      legend.style.top = '10px';
      legend.style.right = '10px';
      legend.style.color = '#AAA';
      legend.style.fontSize = '12px';
      legend.style.backgroundColor = 'rgba(30, 30, 48, 0.8)'; // Semi-transparent background
      legend.style.padding = '5px';
      legend.style.borderRadius = '4px';
      legend.innerHTML = `
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
          <div style="width: 10px; height: 10px; background-color: #4CAF50; border-radius: 50%; margin-right: 5px;"></div>
          <span>Positive Change</span>
        </div>
        <div style="display: flex; align-items: center;">
          <div style="width: 10px; height: 10px; background-color: #FF5252; border-radius: 50%; margin-right: 5px;"></div>
          <span>Negative Change</span>
        </div>
      `;
      scatterContainer.appendChild(legend);
    }

    return () => {
      if (type === 'volatility' && chartContainerRef.current) {
        chartContainerRef.current.innerHTML = '';
      }
    };
  }, [data, height, stockSymbol, type]);

  // Helper function to format volume numbers
  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) {
      return `${(volume / 1000000).toFixed(1)}M`;
    } else if (volume >= 1000) {
      return `${(volume / 1000).toFixed(1)}K`;
    }
    return volume.toString();
  };

  return <div ref={chartContainerRef} style={{ width: '100%' }} />;
};

export { ScatterPlot };