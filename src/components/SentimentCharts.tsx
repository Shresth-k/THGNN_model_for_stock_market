import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, ReferenceLine, Legend 
} from 'recharts';

interface SentimentChartProps {
  data: any[];
  height: number;
  stockSymbol: string;
  type: 'rsi' | 'macd';
}

const SentimentChart: React.FC<SentimentChartProps> = ({ data, height, stockSymbol, type }) => {
  // Check if data exists and has the required fields
  if (!data || data.length === 0) {
    return (
      <div className="w-full text-center p-4">
        <h3 className="text-lg font-semibold mb-2">
          {type === 'rsi' ? 'RSI Indicator' : 'MACD Indicator'} - {stockSymbol}
        </h3>
        <div className="text-gray-400">No data available</div>
      </div>
    );
  }

  // Log the first few data items to debug
  console.log(`${type} data sample:`, data.slice(0, 3));
  
  // Verify data has the required fields
  const hasRequiredFields = data.some(item => {
    if (type === 'rsi') {
      return item.rsi !== undefined;
    } else {
      // For MACD, check both macd and signal_line
      const hasMacd = item.macd !== undefined;
      const hasSignal = item.signal_line !== undefined;
      console.log(`Item check - macd: ${hasMacd}, signal: ${hasSignal}`, item);
      return hasMacd && hasSignal;
    }
  });

  if (!hasRequiredFields) {
    console.error(`Missing ${type} data in dataset`, data[0]);
    return (
      <div className="w-full text-center p-4">
        <h3 className="text-lg font-semibold mb-2">
          {type === 'rsi' ? 'RSI Indicator' : 'MACD Indicator'} - {stockSymbol}
        </h3>
        <div className="text-red-400">Missing required data fields</div>
      </div>
    );
  }

  // Take only the last 90 days of data for better visualization
  const chartData = data.slice(-90);
  
  // Format date for tooltip
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 p-3 border border-gray-700 rounded shadow-lg">
          <p className="text-gray-300">{formatDate(label)}</p>
          {type === 'rsi' ? (
            <p className="font-semibold">
              RSI: <span className={`${payload[0].value > 70 ? 'text-red-400' : payload[0].value < 30 ? 'text-green-400' : 'text-blue-400'}`}>
                {payload[0].value?.toFixed(2)}
              </span>
            </p>
          ) : (
            <>
              <p className="font-semibold">
                MACD: <span className={`${payload[0].value > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {payload[0].value?.toFixed(4)}
                </span>
              </p>
              {payload.length > 1 && (
                <>
                  <p className="font-semibold">
                    Signal: <span className="text-pink-400">
                      {payload[1].value?.toFixed(4)}
                    </span>
                  </p>
                  <p className="font-semibold">
                    Histogram: <span className={`${(payload[0].value - payload[1].value) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {(payload[0].value - payload[1].value)?.toFixed(4)}
                    </span>
                  </p>
                </>
              )}
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-2">
        {type === 'rsi' ? 'RSI Indicator' : 'MACD Indicator'} - {stockSymbol}
      </h3>
      <div className="text-xs text-gray-400 mb-4">
        {type === 'rsi' 
          ? 'RSI > 70: Overbought (Red Zone) | RSI < 30: Oversold (Green Zone)'
          : 'MACD crossing above Signal Line is bullish | MACD crossing below Signal Line is bearish'}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        {type === 'rsi' ? (
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRsiOverbought" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef5350" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#ef5350" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorRsiNeutral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4fc3f7" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#4fc3f7" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorRsiOversold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#66bb6a" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#66bb6a" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2B2B43" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#DDD' }} 
              tickLine={{ stroke: '#DDD' }}
              axisLine={{ stroke: '#DDD' }}
            />
            <YAxis 
              domain={[0, 100]} 
              tick={{ fill: '#DDD' }} 
              tickLine={{ stroke: '#DDD' }}
              axisLine={{ stroke: '#DDD' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={70} stroke="#ef5350" strokeDasharray="3 3" />
            <ReferenceLine y={30} stroke="#66bb6a" strokeDasharray="3 3" />
            <Area 
              type="monotone" 
              dataKey="rsi" 
              stroke="#4fc3f7" 
              fill="url(#colorRsiNeutral)" 
              activeDot={{ r: 6 }}
            />
            {/* Add colored bands for overbought/oversold */}
            <Area 
              type="monotone" 
              dataKey={(d) => d.rsi > 70 ? d.rsi : 70} 
              stroke="none" 
              fill="url(#colorRsiOverbought)" 
              activeDot={false}
              isAnimationActive={false}
            />
            <Area 
              type="monotone" 
              dataKey={(d) => d.rsi < 30 ? d.rsi : 0} 
              stroke="none" 
              fill="url(#colorRsiOversold)" 
              activeDot={false}
              isAnimationActive={false}
              baseValue={0}
            />
          </AreaChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMacd_unique" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff9800" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#ff9800" stopOpacity={0.2}/>
              </linearGradient>
              <linearGradient id="colorSignal_unique" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f48fb1" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#f48fb1" stopOpacity={0.2}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2B2B43" />
            <XAxis 
              dataKey="date" 
              tick={{ fill: '#DDD' }} 
              tickLine={{ stroke: '#DDD' }}
              axisLine={{ stroke: '#DDD' }}
            />
            <YAxis 
              tick={{ fill: '#DDD' }} 
              tickLine={{ stroke: '#DDD' }}
              axisLine={{ stroke: '#DDD' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#DDD" />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="macd" 
              stroke="#ff9800" 
              fill="url(#colorMacd_unique)" 
              activeDot={{ r: 6 }}
              name="MACD"
            />
            <Area 
              type="monotone" 
              dataKey="signal_line" 
              stroke="#f48fb1" 
              fill="url(#colorSignal_unique)" 
              activeDot={{ r: 6 }}
              name="Signal Line"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
};

export { SentimentChart };