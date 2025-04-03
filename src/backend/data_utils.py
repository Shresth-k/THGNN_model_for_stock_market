import os
import numpy as np
import pandas as pd
import pickle
from sklearn.preprocessing import StandardScaler

def create_data_folders():
    """
    Create folders to store original and normalized datasets
    """
    # Create main data directory
    os.makedirs('data_storage', exist_ok=True)
    
    # Create subdirectories
    os.makedirs('data_storage/original', exist_ok=True)
    os.makedirs('data_storage/normalized', exist_ok=True)
    os.makedirs('data_storage/processed', exist_ok=True)
    
    print("Created data storage directories")

def save_original_data(data, filename):
    """
    Save original (non-normalized) data
    
    Args:
        data: Data to save
        filename: Name of the file to save
    """
    filepath = os.path.join('data_storage/original', filename)
    
    if isinstance(data, pd.DataFrame):
        data.to_csv(filepath, index=False)
    else:
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
    
    print(f"Saved original data to {filepath}")

def save_normalized_data(data, filename):
    """
    Save normalized data
    
    Args:
        data: Data to save
        filename: Name of the file to save
    """
    filepath = os.path.join('data_storage/normalized', filename)
    
    if isinstance(data, pd.DataFrame):
        data.to_csv(filepath, index=False)
    else:
        with open(filepath, 'wb') as f:
            pickle.dump(data, f)
    
    print(f"Saved normalized data to {filepath}")

def save_processed_data(data, filename):
    """
    Save processed data (sequences, labels, etc.)
    
    Args:
        data: Data to save
        filename: Name of the file to save
    """
    filepath = os.path.join('data_storage/processed', filename)
    
    with open(filepath, 'wb') as f:
        pickle.dump(data, f)
    
    print(f"Saved processed data to {filepath}")

def denormalize_predictions(predictions, ticker, scalers):
    """
    Denormalize predictions to get actual stock prices
    
    Args:
        predictions: Normalized predictions from the model
        ticker: Stock ticker
        scalers: Dictionary of scalers used for normalization
        
    Returns:
        Denormalized predictions
    """
    if ticker not in scalers:
        raise ValueError(f"No scaler found for ticker {ticker}")
    
    scaler = scalers[ticker]
    
    # Create a dummy array with zeros for all features except the close price
    # The close price is typically the 4th feature (index 3) in the feature list
    dummy = np.zeros((len(predictions), scaler.n_features_in_))
    dummy[:, 3] = predictions.flatten()  # Set close price column
    
    # Inverse transform to get the original scale
    denormalized = scaler.inverse_transform(dummy)[:, 3]
    
    return denormalized

def denormalize_batch_predictions(predictions, tickers, scalers):
    """
    Denormalize a batch of predictions for multiple tickers
    
    Args:
        predictions: Normalized predictions from the model
        tickers: List of stock tickers corresponding to predictions
        scalers: Dictionary of scalers used for normalization
        
    Returns:
        Denormalized predictions
    """
    denormalized_predictions = []
    
    for i, ticker in enumerate(tickers):
        if ticker in scalers:
            scaler = scalers[ticker]
            
            # Create a dummy array with zeros for all features except the close price
            dummy = np.zeros((1, scaler.n_features_in_))
            dummy[0, 3] = predictions[i]  # Set close price column
            
            # Inverse transform to get the original scale
            denormalized = scaler.inverse_transform(dummy)[0, 3]
            denormalized_predictions.append(denormalized)
        else:
            # If no scaler is found, keep the prediction as is
            denormalized_predictions.append(predictions[i])
    
    return np.array(denormalized_predictions)