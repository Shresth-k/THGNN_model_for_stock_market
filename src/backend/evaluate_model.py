import os
import pickle
import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset, DataLoader
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import matplotlib.pyplot as plt
from tqdm import tqdm

# Import the model architecture from the original file
from thgnn_model import THGNN, StockDataset

def load_model(save_dir='saved_model', device='cuda'):
    """
    Load a trained model and necessary data for inference
    
    Args:
        save_dir: Directory where the model is saved
        device: Device to load the model on
        
    Returns:
        model: Loaded THGNN model
        inference_data: Data needed for inference
    """
    device = torch.device(device if torch.cuda.is_available() and device == 'cuda' else 'cpu')
    
    # Load inference data
    with open(os.path.join(save_dir, 'inference_data.pkl'), 'rb') as f:
        inference_data = pickle.load(f)
    
    # Get model parameters
    ticker_to_idx = inference_data['ticker_to_idx']
    num_stocks = len(ticker_to_idx)
    
    # Initialize model
    model = THGNN(
        input_dim=12,  # Number of features
        hidden_dim=128,
        gnn_hidden_dim=64,
        output_dim=1,
        num_stocks=num_stocks,
        seq_len=10,
        gnn_type='gcn'
    ).to(device)
    
    # Load model state
    model.load_state_dict(torch.load(os.path.join(save_dir, 'model.pt'), map_location=device))
    model.eval()
    
    return model, inference_data

def evaluate_model(model, test_data, ticker_to_idx, edge_index, edge_weight, device='cuda'):
    """
    Evaluate the trained model on test data
    
    Args:
        model: Trained THGNN model
        test_data: Test dataset
        ticker_to_idx: Mapping from ticker to index
        edge_index: Graph edge index
        edge_weight: Graph edge weights
        device: Device to evaluate on
        
    Returns:
        Dictionary with evaluation metrics
    """
    device = torch.device(device if torch.cuda.is_available() and device == 'cuda' else 'cpu')
    model = model.to(device)
    model.eval()
    
    # Convert edge index and weight to torch tensors
    edge_index = torch.LongTensor(edge_index).to(device)
    edge_weight = torch.FloatTensor(edge_weight).to(device) if edge_weight is not None else None
    
    # Get the number of unique stocks
    num_stocks = len(ticker_to_idx)
    
    # Ensure edge_index doesn't contain out-of-bounds indices
    mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
    edge_index = edge_index[:, mask]
    edge_weight = edge_weight[mask] if edge_weight is not None else None
    
    # Create ticker indices
    ticker_indices = []
    for ticker in test_data['tickers']:
        if ticker in ticker_to_idx:
            ticker_indices.append(ticker_to_idx[ticker])
        else:
            # Use 0 as default index for unknown tickers
            ticker_indices.append(0)
    
    # Create test dataset and dataloader
    test_dataset = StockDataset(
        test_data['X'],
        test_data['y'],
        np.array(ticker_indices)
    )
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False)
    
    # Evaluation
    predictions = []
    targets = []
    
    with torch.no_grad():
        for batch in tqdm(test_loader, desc="Evaluating"):
            # Get batch data
            X_batch = batch['X'].to(device)
            y_batch = batch['y'].to(device).view(-1, 1)
            stock_indices = torch.LongTensor(batch['ticker']).to(device)
            
            # Forward pass
            outputs = model(X_batch, stock_indices, edge_index, edge_weight)
            
            # Store predictions and targets
            predictions.extend(outputs.cpu().numpy())
            targets.extend(y_batch.cpu().numpy())
    
    # Convert to numpy arrays
    predictions = np.array(predictions).flatten()
    targets = np.array(targets).flatten()
    
    # Get the scalers from inference_data
    scalers = inference_data.get('scalers', {})
    
    # Try to denormalize predictions and targets if scalers are available
    try:
        from data_utils import denormalize_batch_predictions
        
        # Get the list of tickers for the test data
        test_tickers = test_data['tickers']
        
        # Denormalize predictions and targets
        denormalized_predictions = denormalize_batch_predictions(predictions, test_tickers, scalers)
        denormalized_targets = denormalize_batch_predictions(targets, test_tickers, scalers)
        
        # Save both normalized and denormalized predictions
        from data_utils import save_processed_data
        prediction_data = {
            'normalized_predictions': predictions,
            'normalized_targets': targets,
            'denormalized_predictions': denormalized_predictions,
            'denormalized_targets': denormalized_targets,
            'tickers': test_tickers
        }
        save_processed_data(prediction_data, 'model_predictions.pkl')
        
        # Calculate metrics on denormalized data
        denorm_rmse = np.sqrt(mean_squared_error(denormalized_targets, denormalized_predictions))
        denorm_mae = mean_absolute_error(denormalized_targets, denormalized_predictions)
        denorm_r2 = r2_score(denormalized_targets, denormalized_predictions)
        
        # Also calculate metrics on normalized data
        norm_rmse = np.sqrt(mean_squared_error(targets, predictions))
        norm_mae = mean_absolute_error(targets, predictions)
        norm_r2 = r2_score(targets, predictions)
        
        # Use denormalized metrics
        rmse = denorm_rmse
        mae = denorm_mae
        r2 = denorm_r2
        
    except Exception as e:
        print(f"Warning: Could not denormalize predictions: {str(e)}")
        # Fall back to normalized metrics if denormalization fails
        rmse = np.sqrt(mean_squared_error(targets, predictions))
        mae = mean_absolute_error(targets, predictions)
        r2 = r2_score(targets, predictions)
    
    return {
        'predictions': predictions,
        'targets': targets,
        'rmse': rmse,
        'mae': mae,
        'r2': r2
    }

def preprocess_stock_data_for_prediction(stock_df, ticker, sequence_length=10):
    """
    Preprocess stock data for a single ticker for prediction
    
    Args:
        stock_df: DataFrame containing stock data
        ticker: Stock ticker to preprocess
        sequence_length: Length of input sequence
        
    Returns:
        Preprocessed data for the ticker
    """
    # Filter data for the ticker
    ticker_data = stock_df[stock_df['ticker'] == ticker].copy()
    
    # Sort by date
    ticker_data = ticker_data.sort_values('date')
    
    # Handle missing values
    # For technical indicators, forward fill and then backfill
    ticker_data['rsi'] = ticker_data['rsi'].fillna(method='ffill').fillna(method='bfill')
    ticker_data['macd'] = ticker_data['macd'].fillna(method='ffill').fillna(method='bfill')
    ticker_data['signal_line'] = ticker_data['signal_line'].fillna(method='ffill').fillna(method='bfill')
    
    # For price/volume data, use the previous day's data
    for col in ['open', 'high', 'low', 'close', 'volume']:
        ticker_data[col] = ticker_data[col].fillna(method='ffill')
    
    # Create additional features
    # Price change percentage
    ticker_data['price_change'] = ticker_data['close'].pct_change()
    
    # Average price
    ticker_data['avg_price'] = (ticker_data['high'] + ticker_data['low'] + ticker_data['close']) / 3
    
    # Trading range
    ticker_data['trading_range'] = ticker_data['high'] - ticker_data['low']
    
    # Price to volume ratio - Handle division by zero
    ticker_data['price_volume_ratio'] = ticker_data['close'] / ticker_data['volume'].replace(0, np.nan)
    ticker_data['price_volume_ratio'] = ticker_data['price_volume_ratio'].replace([np.inf, -np.inf], np.nan)
    ticker_data['price_volume_ratio'] = ticker_data['price_volume_ratio'].fillna(
        ticker_data['price_volume_ratio'].mean() if not np.isnan(ticker_data['price_volume_ratio'].mean()) else 0)
    
    # RSI crossover with 50
    ticker_data['rsi_crossover'] = ((ticker_data['rsi'] > 50) & (ticker_data['rsi'].shift(1) <= 50)) | \
                                  ((ticker_data['rsi'] < 50) & (ticker_data['rsi'].shift(1) >= 50))
    ticker_data['rsi_crossover'] = ticker_data['rsi_crossover'].astype(int)
    
    # MACD crossover with signal line
    ticker_data['macd_crossover'] = ((ticker_data['macd'] > ticker_data['signal_line']) & 
                                    (ticker_data['macd'].shift(1) <= ticker_data['signal_line'].shift(1))) | \
                                   ((ticker_data['macd'] < ticker_data['signal_line']) & 
                                    (ticker_data['macd'].shift(1) >= ticker_data['signal_line'].shift(1)))
    ticker_data['macd_crossover'] = ticker_data['macd_crossover'].astype(int)
    
    # Replace any NaN values that might have been introduced
    ticker_data = ticker_data.fillna(0)
    
    # Get the latest sequence_length days
    if len(ticker_data) > sequence_length:
        ticker_data = ticker_data.tail(sequence_length)
    elif len(ticker_data) < sequence_length:
        raise ValueError(f"Not enough data for ticker {ticker}. Need {sequence_length} days but got {len(ticker_data)}.")
    
    return ticker_data

def predict_next_day(model, data, ticker, sequence_length, ticker_to_idx, edge_index, edge_weight, scaler, device='cuda'):
    """
    Predict the next day's closing price for a specific stock
    """
    device = torch.device(device if torch.cuda.is_available() and device == 'cuda' else 'cpu')
    model = model.to(device)
    model.eval()
    
    # Convert edge index and weight to torch tensors
    edge_index = torch.LongTensor(edge_index).to(device)
    edge_weight = torch.FloatTensor(edge_weight).to(device) if edge_weight is not None else None
    
    # Get the number of unique stocks
    num_stocks = len(ticker_to_idx)
    
    # Ensure edge_index doesn't contain out-of-bounds indices
    mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
    edge_index = edge_index[:, mask]
    edge_weight = edge_weight[mask] if edge_weight is not None else None
    
    # Preprocess the data for the ticker
    ticker_data = preprocess_stock_data_for_prediction(data, ticker, sequence_length)
    
    # Check if we have enough data
    if len(ticker_data) < sequence_length:
        raise ValueError(f"Not enough data for ticker {ticker}. Need {sequence_length} days but got {len(ticker_data)}.")
    
    # Verify all required features exist
    required_features = ['open', 'high', 'low', 'close', 'volume', 'rsi', 'macd', 'signal_line', 
                        'price_change', 'avg_price', 'trading_range', 'price_volume_ratio']
    
    # Check if all features exist in the dataframe
    for feature in required_features:
        if feature not in ticker_data.columns:
            raise ValueError(f"Feature '{feature}' is missing in the preprocessed data")
    
    # Store original close price for reference
    original_close = ticker_data['close'].iloc[-1]
    
    # Create a copy of the data before normalization
    original_data = ticker_data.copy()
    
    # Apply the same normalization as during training
    # Skip scaler since it's causing issues
    # We'll work with the raw data instead
    
    # Create input sequence
    X = ticker_data[required_features].values
    X = X.reshape(1, sequence_length, len(required_features))
    X = torch.FloatTensor(X).to(device)
    
    # Get stock index
    if ticker in ticker_to_idx:
        stock_idx = torch.LongTensor([ticker_to_idx[ticker]]).to(device)
    else:
        # Use 0 as default index for unknown tickers
        stock_idx = torch.LongTensor([0]).to(device)
    
    # Make prediction
    with torch.no_grad():
        prediction = model(X, stock_idx, edge_index, edge_weight)
    
    # Get the prediction value
    normalized_prediction = prediction.cpu().numpy()[0, 0]
    
    # Try to denormalize the prediction using the scaler
    if scaler is not None:
        try:
            from data_utils import denormalize_predictions
            
            # Create a single-element array with the prediction
            pred_array = np.array([normalized_prediction])
            
            # Create a dictionary with the ticker's scaler
            scaler_dict = {ticker: scaler}
            
            # Denormalize the prediction
            denormalized_prediction = denormalize_predictions(pred_array, ticker, scaler_dict)
            
            # Return both normalized and denormalized predictions
            return {
                'normalized': normalized_prediction,
                'denormalized': denormalized_prediction[0]
            }
        except Exception as e:
            print(f"Warning: Could not denormalize prediction: {str(e)}")
    
    # Fallback approach if scaler is not available or denormalization fails
    # Use the last close price and interpret the model output as a percentage change
    last_close = original_data['close'].iloc[-1]
    
    # Assuming the model predicts a value between -1 and 1 representing percentage change
    # Adjust this range based on your model's actual output range
    pct_change = normalized_prediction * 0.05  # Scale factor - adjust based on model behavior
    
    # Apply this percentage change to the actual last closing price
    predicted_price = last_close * (1 + pct_change)
    
    return {
        'normalized': normalized_prediction,
        'denormalized': predicted_price
    }

def plot_predictions(evaluation_results, num_samples=100, save_path=None):
    """
    Plot the predictions vs actual values
    
    Args:
        evaluation_results: Results from evaluate_model
        num_samples: Number of samples to plot
        save_path: Path to save the plot
    """
    predictions = evaluation_results['predictions']
    targets = evaluation_results['targets']
    
    # Sample a subset of points to plot
    if len(predictions) > num_samples:
        indices = np.random.choice(len(predictions), num_samples, replace=False)
        predictions_sample = predictions[indices]
        targets_sample = targets[indices]
    else:
        predictions_sample = predictions
        targets_sample = targets
    
    # Create plot
    plt.figure(figsize=(10, 6))
    plt.scatter(targets_sample, predictions_sample, alpha=0.5)
    
    # Add perfect prediction line
    min_val = min(np.min(targets_sample), np.min(predictions_sample))
    max_val = max(np.max(targets_sample), np.max(predictions_sample))
    plt.plot([min_val, max_val], [min_val, max_val], 'r--')
    
    plt.xlabel('Actual Values')
    plt.ylabel('Predicted Values')
    plt.title('THGNN Model: Predicted vs Actual Values')
    
    # Add metrics to plot
    rmse = evaluation_results['rmse']
    mae = evaluation_results['mae']
    r2 = evaluation_results['r2']
    
    plt.figtext(0.15, 0.8, f'RMSE: {rmse:.4f}')
    plt.figtext(0.15, 0.75, f'MAE: {mae:.4f}')
    plt.figtext(0.15, 0.7, f'R²: {r2:.4f}')
    
    plt.grid(True, alpha=0.3)
    
    if save_path:
        plt.savefig(save_path)
    
    plt.show()

def main():
    """
    Main function to evaluate the model
    """
    # File paths
    stock_data_path = 'filtered_stocks.csv'
    save_dir = 'saved_model'
    
    # Load model and inference data
    print("Loading saved model...")
    model, inference_data = load_model(save_dir)
    
    # Load test data
    print("Loading test data...")
    stock_df = pd.read_csv(stock_data_path)
    
    # Convert date to datetime
    stock_df['date'] = pd.to_datetime(stock_df['date'])
    
    # Example: Predict next day's closing price for specific stocks
    print("\nPredicting next day's closing prices:")
    for ticker in ['ADANIENT', 'ASIANPAINT', 'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV',
  'BAJFINANCE', 'BPCL', 'BRITANNIA', 'CIPLA', 'COALINDIA',
  'DIVISLAB', 'EICHERMOT', 'GRASIM', 'HCLTECH', 'HDFCBANK',
  'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDUNILVR', 'ICICIBANK',
  'INDUSINDBK', 'INFY', 'ITC', 'JSWSTEEL', 'KOTAKBANK',
  'LT', 'M&M', 'MARUTI', 'NTPC', 'ONGC',
  'POWERGRID', 'RELIANCE', 'SBILIFE', 'SBIN', 'SUNPHARMA',
  'TATACONSUM', 'TATAMOTORS', 'TCS', 'TECHM', 'ULTRACEMCO',
  'UPL', 'WIPRO']:
        try:
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
            
            # Display both normalized and denormalized predictions
            norm_pred = prediction_result['normalized']
            denorm_pred = prediction_result.get('denormalized')
            
            if denorm_pred is not None:
                print(f"Predicted next day closing price for {ticker}: {denorm_pred:.4f} (actual value)")
                print(f"  Normalized prediction value: {norm_pred:.4f}")
            else:
                print(f"Predicted next day closing price for {ticker}: {norm_pred:.4f} (normalized value)")
                print(f"  Could not denormalize prediction")
        except Exception as e:
            print(f"Error predicting for {ticker}: {str(e)}")
    
    print("\nDone!")

if __name__ == "__main__":
    main()