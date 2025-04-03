from flask import Flask, jsonify, request
from flask_cors import CORS
import os
import sys
import json
import pandas as pd
from datetime import datetime, timedelta

# Add the current directory to the path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the prediction function
from evaluate_model import predict_next_day, load_model

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load the model and inference data once when the server starts
print("Loading model and inference data...")
try:
    model, inference_data = load_model('saved_model')
    print("Model loaded successfully")
except Exception as e:
    print(f"Error loading model: {str(e)}")
    model = None
    inference_data = None

# Load stock data
try:
    stock_df = pd.read_csv('filtered_stocks.csv')
    stock_df['date'] = pd.to_datetime(stock_df['date'])
    print("Stock data loaded successfully")
except Exception as e:
    print(f"Error loading stock data: {str(e)}")
    stock_df = None

# Cache for predictions to avoid recalculating
prediction_cache = {}
last_cache_update = datetime.now() - timedelta(days=1)  # Initialize to force update on first request

@app.route('/api/prediction/<ticker>', methods=['GET'])
def get_prediction(ticker):
    global prediction_cache, last_cache_update
    
    # Check if we need to refresh the cache (once per day)
    current_time = datetime.now()
    if (current_time - last_cache_update).days >= 1:
        prediction_cache = {}
        last_cache_update = current_time
    
    # Return from cache if available
    if ticker in prediction_cache:
        return jsonify(prediction_cache[ticker])
    
    # Check if model and data are loaded
    if model is None or inference_data is None or stock_df is None:
        return jsonify({
            'error': 'Model or data not loaded properly',
            'status': 'error'
        }), 500
    
    try:
        # Get the prediction for the ticker
        prediction_result = predict_next_day(
            model=model,
            data=stock_df,
            ticker=ticker,
            sequence_length=10,
            ticker_to_idx=inference_data['ticker_to_idx'],
            edge_index=inference_data['edge_index'],
            edge_weight=inference_data['edge_weight'],
            scaler=inference_data['scalers'].get(ticker),
            device='cuda'
        )
        
        # Get the latest actual price
        latest_data = stock_df[stock_df['ticker'] == ticker].sort_values('date').iloc[-1]
        latest_date = latest_data['date'].strftime('%Y-%m-%d')
        latest_price = latest_data['close']
        
        # Calculate next business day
        next_date = pd.to_datetime(latest_date) + pd.Timedelta(days=1)
        while next_date.weekday() >= 5:  # Skip weekends
            next_date += pd.Timedelta(days=1)
        
        # Prepare response
        response = {
            'ticker': ticker,
            'latest_date': latest_date,
            'latest_price': float(latest_price),
            'predicted_date': next_date.strftime('%Y-%m-%d'),
            'predicted_price': float(prediction_result['denormalized']),
            'normalized_prediction': float(prediction_result['normalized']),
            'percent_change': float(((prediction_result['denormalized'] - latest_price) / latest_price) * 100),
            'status': 'success'
        }
        
        # Cache the result
        prediction_cache[ticker] = response
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error predicting for {ticker}: {str(e)}")
        return jsonify({
            'error': str(e),
            'status': 'error'
        }), 500

@app.route('/api/stocks', methods=['GET'])
def get_stocks():
    """Return the list of available stocks"""
    stocks = [
        'ADANIENT', 'ASIANPAINT', 'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV',
        'BAJFINANCE', 'BPCL', 'BRITANNIA', 'CIPLA', 'COALINDIA',
        'DIVISLAB', 'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCBANK',
        'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK',
        'INDUSINDBK', 'INFY', 'ITC', 'JSWSTEEL', 'KOTAKBANK',
        'LT', 'M&M', 'MARUTI', 'NTPC', 'ONGC',
        'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 'SUNPHARMA',
        'TATACONSUM', 'TATAMOTORS', 'TCS', 'TECHM', 'ULTRACEMCO',
        'UPL', 'WIPRO'
    ]
    return jsonify(stocks)

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)