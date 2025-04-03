import React from 'react';
import { MessageSquare, BarChart2, PieChart, Settings2, Info } from 'lucide-react';

const ConversationPanel = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex border-b border-gray-700 p-4">
        <button className="flex items-center space-x-2 px-4 py-2 bg-gray-800 rounded-lg">
          <MessageSquare className="w-4 h-4" />
          <span>Chat</span>
        </button>
        <button className="flex items-center space-x-2 px-4 py-2 text-gray-400 hover:text-white ml-2">
          <Info className="w-4 h-4" />
          <span>Model Info</span>
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-300">System</p>
          <p className="mt-2">
            Welcome to the THGNN Stock Prediction Model. I can help you analyze stock data and provide predictions based on our advanced neural network model.
          </p>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-300">User</p>
          <p className="mt-2">
            Can you analyze the current market trend?
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-sm text-gray-300">Assistant</p>
          <p className="mt-2">
            Based on the current market data, we're seeing a bullish trend with strong momentum. The THGNN model indicates a 87% confidence in continued upward movement over the next trading session.
          </p>
          <div className="mt-4 flex space-x-2">
            <button className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">View Analysis</button>
            <button className="px-3 py-1.5 bg-gray-700 rounded-lg text-sm hover:bg-gray-600">Show Predictions</button>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-4">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Ask about stock analysis..."
            className="flex-1 bg-gray-800 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button className="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600">
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConversationPanel;