import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
import matplotlib.pyplot as plt
import networkx as nx
from tqdm import tqdm
import os
import warnings
import pickle
warnings.filterwarnings('ignore')

# For PyTorch Geometric
import torch_geometric
from torch_geometric.nn import GCNConv, GATConv, SAGEConv
from torch_geometric.data import Data

#########################
# 1. Data Preprocessing #
#########################

def preprocess_stock_data(stock_data_path, relationship_data_path, sequence_length=10):
    """
    Preprocess the stock data and relationships for the THGNN model.
    
    Args:
        stock_data_path: Path to the CSV file containing stock data
        relationship_data_path: Path to the CSV file containing stock relationships
        sequence_length: Number of days to use as input sequence for prediction
        
    Returns:
        Preprocessed data including sequences, labels, and graph structure
    """
    # Create data storage folders
    from data_utils import create_data_folders, save_original_data
    create_data_folders()
    print("Loading stock data...")
    # Load stock data
    stock_df = pd.read_csv(stock_data_path)
    
    # Convert date to datetime
    stock_df['date'] = pd.to_datetime(stock_df['date'])
    
    # Check for missing values
    missing_values = stock_df.isnull().sum()
    print(f"Missing values in the dataset:\n{missing_values}")
    
    # Handle missing values
    # For technical indicators, forward fill and then backfill
    stock_df['rsi'] = stock_df.groupby('ticker')['rsi'].transform(lambda x: x.fillna(method='ffill').fillna(method='bfill'))
    stock_df['macd'] = stock_df.groupby('ticker')['macd'].transform(lambda x: x.fillna(method='ffill').fillna(method='bfill'))
    stock_df['signal_line'] = stock_df.groupby('ticker')['signal_line'].transform(lambda x: x.fillna(method='ffill').fillna(method='bfill'))
    
    # For price/volume data, use the previous day's data
    for col in ['open', 'high', 'low', 'close', 'volume']:
        stock_df[col] = stock_df.groupby('ticker')[col].transform(lambda x: x.fillna(method='ffill'))
    
    # Drop any remaining rows with missing values
    stock_df = stock_df.dropna()
    
    # Sort by date and ticker
    stock_df = stock_df.sort_values(['ticker', 'date'])
    
    # Create additional features
    print("Creating additional features...")
    # Price change percentage
    stock_df['price_change'] = stock_df.groupby('ticker')['close'].pct_change()
    
    # Average price
    stock_df['avg_price'] = (stock_df['high'] + stock_df['low'] + stock_df['close']) / 3
    
    # Trading range
    stock_df['trading_range'] = stock_df['high'] - stock_df['low']
    
    # Price to volume ratio - Fix: Handle division by zero
    stock_df['price_volume_ratio'] = stock_df['close'] / stock_df['volume'].replace(0, np.nan)
    stock_df['price_volume_ratio'] = stock_df['price_volume_ratio'].replace([np.inf, -np.inf], np.nan)
    stock_df['price_volume_ratio'] = stock_df.groupby('ticker')['price_volume_ratio'].transform(
        lambda x: x.fillna(x.mean() if not np.isnan(x.mean()) else 0))
    
    # RSI crossover with 50
    stock_df['rsi_crossover'] = ((stock_df['rsi'] > 50) & (stock_df.groupby('ticker')['rsi'].shift(1) <= 50)) | \
                              ((stock_df['rsi'] < 50) & (stock_df.groupby('ticker')['rsi'].shift(1) >= 50))
    stock_df['rsi_crossover'] = stock_df['rsi_crossover'].astype(int)
    
    # MACD crossover with signal line
    stock_df['macd_crossover'] = ((stock_df['macd'] > stock_df['signal_line']) & 
                                (stock_df.groupby('ticker')['macd'].shift(1) <= stock_df.groupby('ticker')['signal_line'].shift(1))) | \
                               ((stock_df['macd'] < stock_df['signal_line']) & 
                                (stock_df.groupby('ticker')['macd'].shift(1) >= stock_df.groupby('ticker')['signal_line'].shift(1)))
    stock_df['macd_crossover'] = stock_df['macd_crossover'].astype(int)
    
    # Drop the first row for each ticker (due to pct_change)
    stock_df = stock_df.dropna()
    
    # Save original data before normalization
    from data_utils import save_original_data, save_normalized_data
    original_stock_df = stock_df.copy()
    save_original_data(original_stock_df, 'original_stock_data.csv')
    
    # Normalize features
    print("Normalizing features...")
    
    # Features to normalize
    features = ['open', 'high', 'low', 'close', 'volume', 'rsi', 'macd', 'signal_line', 
                'price_change', 'avg_price', 'trading_range', 'price_volume_ratio']
    
    # Replace any remaining NaN, inf values before normalization
    stock_df[features] = stock_df[features].replace([np.inf, -np.inf], np.nan)
    stock_df[features] = stock_df[features].fillna(method='ffill').fillna(method='bfill').fillna(0)
    
    # Group by ticker and apply normalization
    scalers = {}
    normalized_stock_df = stock_df.copy()
    for ticker in stock_df['ticker'].unique():
        ticker_mask = stock_df['ticker'] == ticker
        scaler = StandardScaler()
        normalized_stock_df.loc[ticker_mask, features] = scaler.fit_transform(stock_df.loc[ticker_mask, features])
        scalers[ticker] = scaler
    
    # Save normalized data
    save_normalized_data(normalized_stock_df, 'normalized_stock_data.csv')
    
    # Use normalized data for further processing
    stock_df = normalized_stock_df
    
    # Create sequences for each stock
    print("Creating sequences...")
    
    sequences = []
    labels = []
    dates = []
    tickers = []
    
    for ticker in stock_df['ticker'].unique():
        ticker_data = stock_df[stock_df['ticker'] == ticker]
        
        for i in range(len(ticker_data) - sequence_length):
            # Extract sequence
            seq = ticker_data.iloc[i:i+sequence_length][features].values
            # Extract label (next day's closing price)
            label = ticker_data.iloc[i+sequence_length]['close']
            
            sequences.append(seq)
            labels.append(label)
            dates.append(ticker_data.iloc[i+sequence_length]['date'])
            tickers.append(ticker)
    
    # Convert to arrays
    X = np.array(sequences)
    y = np.array(labels)
    dates = np.array(dates)
    tickers = np.array(tickers)
    
    # Process relationship data
    print("Processing relationship data...")
    relationships_df = pd.read_csv(relationship_data_path)
    
    # Create a dictionary to map from ticker to index
    ticker_to_idx = {ticker: idx for idx, ticker in enumerate(stock_df['ticker'].unique())}
    
    # Create adjacency matrix
    num_stocks = len(ticker_to_idx)
    adj_matrix = np.zeros((num_stocks, num_stocks))
    
    # Fill adjacency matrix based on relationships
    for _, row in relationships_df.iterrows():
        stock1 = row['stock1']
        stock2 = row['stock2']
        weight = row['weight']
        
        # Skip if either stock is not in our dataset
        if stock1 not in ticker_to_idx or stock2 not in ticker_to_idx:
            continue
            
        idx1 = ticker_to_idx[stock1]
        idx2 = ticker_to_idx[stock2]
        
        adj_matrix[idx1, idx2] = weight
        adj_matrix[idx2, idx1] = weight  # Ensure symmetry
    
    # Create edge index and edge weight for PyTorch Geometric
    edge_index = []
    edge_weight = []
    
    for i in range(num_stocks):
        for j in range(num_stocks):
            if adj_matrix[i, j] > 0:
                edge_index.append([i, j])
                edge_weight.append(adj_matrix[i, j])
    
    edge_index = np.array(edge_index).T  # Convert to PyTorch Geometric format
    edge_weight = np.array(edge_weight)
    
    return {
        'X': X,                       # Input sequences
        'y': y,                       # Target values (next day closing prices)
        'dates': dates,               # Corresponding dates
        'tickers': tickers,           # Corresponding tickers
        'ticker_to_idx': ticker_to_idx,  # Mapping from ticker to index
        'edge_index': edge_index,     # Graph edge indices
        'edge_weight': edge_weight,   # Graph edge weights
        'scalers': scalers            # Scalers for denormalization
    }


class StockDataset(Dataset):
    """
    Dataset class for stock price prediction.
    """
    def __init__(self, X, y, tickers):
        self.X = torch.FloatTensor(X)
        self.y = torch.FloatTensor(y)
        self.tickers = tickers
    
    def __len__(self):
        return len(self.X)
    
    def __getitem__(self, idx):
        return {
            'X': self.X[idx],
            'y': self.y[idx],
            'ticker': self.tickers[idx]
        }


############################
# 2. THGNN Model Architecture #
############################

class TemporalAttention(nn.Module):
    """
    Temporal attention module to focus on important time steps
    """
    def __init__(self, input_dim):
        super(TemporalAttention, self).__init__()
        self.fc = nn.Linear(input_dim, 1)
    
    def forward(self, x):
        # x shape: (batch_size, seq_len, input_dim)
        # Calculate attention scores
        scores = self.fc(x)  # (batch_size, seq_len, 1)
        scores = F.softmax(scores, dim=1)  # (batch_size, seq_len, 1)
        
        # Apply attention weights
        context = torch.sum(x * scores, dim=1)  # (batch_size, input_dim)
        return context, scores


class GNNLayer(nn.Module):
    """
    Graph Neural Network layer that can be configured to use different GNN types
    """
    def __init__(self, in_channels, out_channels, gnn_type='gcn'):
        super(GNNLayer, self).__init__()
        
        if gnn_type == 'gcn':
            self.conv = GCNConv(in_channels, out_channels)
        elif gnn_type == 'gat':
            self.conv = GATConv(in_channels, out_channels)
        elif gnn_type == 'sage':
            self.conv = SAGEConv(in_channels, out_channels)
        else:
            raise ValueError(f"Unknown GNN type: {gnn_type}")
    
    def forward(self, x, edge_index, edge_weight=None):
        return self.conv(x, edge_index, edge_weight)


class THGNN(nn.Module):
    """
    Temporal Hypergraph Neural Network model for stock price prediction
    """
    def __init__(self, input_dim, hidden_dim, gnn_hidden_dim, output_dim, num_stocks,
                 seq_len, gnn_type='gcn', num_gnn_layers=2, dropout=0.2):
        super(THGNN, self).__init__()
        
        # Model dimensions
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.gnn_hidden_dim = gnn_hidden_dim
        self.output_dim = output_dim
        self.num_stocks = num_stocks
        self.seq_len = seq_len
        
        # Temporal feature extraction (LSTM)
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=2,
            batch_first=True,
            dropout=dropout,
            bidirectional=True
        )
        
        # Temporal attention
        self.temporal_attention = TemporalAttention(hidden_dim * 2)  # *2 for bidirectional
        
        # Stock-specific embeddings
        self.stock_embeddings = nn.Embedding(num_stocks, gnn_hidden_dim)
        
        # GNN layers for hypergraph representation
        self.gnn_layers = nn.ModuleList()
        # First GNN layer takes temporal features + stock embeddings
        self.gnn_layers.append(GNNLayer(hidden_dim * 2 + gnn_hidden_dim, gnn_hidden_dim, gnn_type))
        
        # Additional GNN layers
        for _ in range(num_gnn_layers - 1):
            self.gnn_layers.append(GNNLayer(gnn_hidden_dim, gnn_hidden_dim, gnn_type))
        
        # Feature fusion layer
        self.fusion = nn.Sequential(
            nn.Linear(hidden_dim * 2 + gnn_hidden_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(dropout)
        )
        
        # Output layer
        self.output = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim // 2, output_dim)
        )
    
    def forward(self, x, stock_indices, edge_index, edge_weight=None):
        """
        Forward pass of the THGNN model
        
        Args:
            x: Input sequences (batch_size, seq_len, input_dim)
            stock_indices: Indices of stocks in the batch (batch_size)
            edge_index: Graph edge index (2, num_edges)
            edge_weight: Graph edge weights (num_edges)
            
        Returns:
            Predicted values (batch_size, output_dim)
        """
        batch_size = x.size(0)
        
        # Temporal feature extraction
        lstm_out, _ = self.lstm(x)  # (batch_size, seq_len, hidden_dim*2)
        
        # Apply temporal attention
        temporal_features, _ = self.temporal_attention(lstm_out)  # (batch_size, hidden_dim*2)
        
        # Get stock embeddings
        stock_emb = self.stock_embeddings(stock_indices)  # (batch_size, gnn_hidden_dim)
        
        # Combine temporal features and stock embeddings
        node_features = torch.cat([temporal_features, stock_emb], dim=1)  # (batch_size, hidden_dim*2 + gnn_hidden_dim)
        
        # Create a graph data object
        # Note: In a real implementation, we'd create this once per batch and reuse
        graph_data = Data(x=node_features, edge_index=edge_index)
        if edge_weight is not None:
            graph_data.edge_weight = edge_weight
        
        # Apply GNN layers
        gnn_features = node_features
        for gnn_layer in self.gnn_layers:
            # Ensure edge_index doesn't contain out-of-bounds indices
            batch_size = gnn_features.size(0)
            valid_mask = (edge_index[0] < batch_size) & (edge_index[1] < batch_size)
            valid_edge_index = edge_index[:, valid_mask]
            valid_edge_weight = edge_weight[valid_mask] if edge_weight is not None else None
            
            gnn_features = gnn_layer(gnn_features, valid_edge_index, valid_edge_weight)
            gnn_features = F.relu(gnn_features)
        
        # Fuse temporal and graph features
        fused_features = self.fusion(
            torch.cat([temporal_features, gnn_features], dim=1)
        )
        
        # Output layer
        output = self.output(fused_features)
        
        return output


############################
# 3. Training and Evaluation #
############################

def train_thgnn_model(preprocessed_data, batch_size=64, epochs=100, lr=0.001, weight_decay=1e-5,
                     hidden_dim=128, gnn_hidden_dim=64, gnn_type='gcn', device='cuda'):
    """
    Train the THGNN model
    
    Args:
        preprocessed_data: Data from the preprocess_stock_data function
        batch_size: Batch size for training
        epochs: Number of training epochs
        lr: Learning rate
        weight_decay: Weight decay for regularization
        hidden_dim: Hidden dimension for LSTM
        gnn_hidden_dim: Hidden dimension for GNN
        gnn_type: Type of GNN ('gcn', 'gat', 'sage')
        device: Device to train on ('cuda' or 'cpu')
        
    Returns:
        Trained model and training history
    """
    # Set device
    device = torch.device(device if torch.cuda.is_available() and device == 'cuda' else 'cpu')
    print(f"Using device: {device}")
    
    # Extract data
    X = preprocessed_data['X']
    y = preprocessed_data['y']
    tickers = preprocessed_data['tickers']
    ticker_to_idx = preprocessed_data['ticker_to_idx']
    edge_index = preprocessed_data['edge_index']
    edge_weight = preprocessed_data['edge_weight']
    
    # Convert edge index and weight to torch tensors
    edge_index = torch.LongTensor(edge_index).to(device)
    edge_weight = torch.FloatTensor(edge_weight).to(device)
    
    # Get the number of unique stocks in the dataset
    num_stocks = len(ticker_to_idx)
    
    # Ensure edge_index doesn't contain out-of-bounds indices
    mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
    edge_index = edge_index[:, mask]
    edge_weight = edge_weight[mask] if edge_weight is not None else None
    
    # Get the number of unique stocks in the dataset
    num_stocks = len(ticker_to_idx)
    
    # Ensure edge_index doesn't contain out-of-bounds indices
    mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
    edge_index = edge_index[:, mask]
    edge_weight = edge_weight[mask] if edge_weight is not None else None
    
    # Create ticker indices
    ticker_indices = np.array([ticker_to_idx[ticker] for ticker in tickers])
    
    # Split the data into train and validation sets
    X_train, X_val, y_train, y_val, indices_train, indices_val = train_test_split(
        X, y, ticker_indices, test_size=0.2, random_state=42)
    
    # Create datasets
    train_dataset = StockDataset(X_train, y_train, indices_train)
    val_dataset = StockDataset(X_val, y_val, indices_val)
    
    # Create data loaders
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
    
    # Initialize model
    input_dim = X.shape[2]  # Number of features
    output_dim = 1  # Predicting the next day's closing price
    num_stocks = len(ticker_to_idx)
    seq_len = X.shape[1]  # Sequence length
    
    model = THGNN(
        input_dim=input_dim,
        hidden_dim=hidden_dim,
        gnn_hidden_dim=gnn_hidden_dim,
        output_dim=output_dim,
        num_stocks=num_stocks,
        seq_len=seq_len,
        gnn_type=gnn_type
    ).to(device)
    
    # Define loss function and optimizer
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=weight_decay)
    
    # Learning rate scheduler
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode='min', factor=0.5, patience=10, verbose=True)
    
    # Training history
    history = {
        'train_loss': [],
        'val_loss': [],
        'val_rmse': [],
        'val_mae': []
    }
    
    # Early stopping
    best_val_loss = float('inf')
    patience = 20
    patience_counter = 0
    best_model_state = None
    
    # Training loop
    for epoch in range(epochs):
        model.train()
        train_loss = 0
        
        for batch in tqdm(train_loader, desc=f"Epoch {epoch+1}/{epochs}"):
            # Get batch data
            X_batch = batch['X'].to(device)
            y_batch = batch['y'].to(device).view(-1, 1)
            stock_indices = torch.LongTensor(batch['ticker']).to(device)
            
            # Forward pass
            optimizer.zero_grad()
            outputs = model(X_batch, stock_indices, edge_index, edge_weight)
            
            # Calculate loss
            loss = criterion(outputs, y_batch)
            
            # Backward pass and optimize
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            
            train_loss += loss.item()
        
        # Calculate average training loss
        train_loss /= len(train_loader)
        history['train_loss'].append(train_loss)
        
        # Validation
        model.eval()
        val_loss = 0
        val_predictions = []
        val_targets = []
        
        with torch.no_grad():
            for batch in val_loader:
                # Get batch data
                X_batch = batch['X'].to(device)
                y_batch = batch['y'].to(device).view(-1, 1)
                stock_indices = torch.LongTensor(batch['ticker']).to(device)
                
                # Forward pass
                outputs = model(X_batch, stock_indices, edge_index, edge_weight)
                
                # Calculate loss
                loss = criterion(outputs, y_batch)
                val_loss += loss.item()
                
                # Store predictions and targets
                val_predictions.extend(outputs.cpu().numpy())
                val_targets.extend(y_batch.cpu().numpy())
        
        # Calculate average validation loss
        val_loss /= len(val_loader)
        history['val_loss'].append(val_loss)
        
        # Calculate validation metrics
        val_predictions = np.array(val_predictions)
        val_targets = np.array(val_targets)
        val_rmse = np.sqrt(np.mean((val_predictions - val_targets) ** 2))
        val_mae = np.mean(np.abs(val_predictions - val_targets))
        
        history['val_rmse'].append(val_rmse)
        history['val_mae'].append(val_mae)
        
        # Update learning rate
        scheduler.step(val_loss)
        
        # Early stopping
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            best_model_state = model.state_dict().copy()
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping at epoch {epoch+1}")
                break
        
        # Print progress
        print(f"Epoch {epoch+1}/{epochs}, Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}, "
              f"Val RMSE: {val_rmse:.4f}, Val MAE: {val_mae:.4f}")
    
    # Load best model
    if best_model_state is not None:
        model.load_state_dict(best_model_state)
    
    # Create train and validation datasets for saving
    train_data = {
        'X': X_train,
        'y': y_train,
        'tickers': np.array([list(ticker_to_idx.keys())[list(ticker_to_idx.values()).index(idx)] for idx in indices_train])
    }
    
    val_data = {
        'X': X_val,
        'y': y_val,
        'tickers': np.array([list(ticker_to_idx.keys())[list(ticker_to_idx.values()).index(idx)] for idx in indices_val])
    }
    
    return model, history, train_data, val_data


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
    edge_weight = torch.FloatTensor(edge_weight).to(device)
    
    # Get the number of unique stocks in the dataset
    num_stocks = len(ticker_to_idx)
    
    # Ensure edge_index doesn't contain out-of-bounds indices
    mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
    edge_index = edge_index[:, mask]
    edge_weight = edge_weight[mask] if edge_weight is not None else None
    
    # Create test dataset and dataloader
    test_dataset = StockDataset(
        test_data['X'],
        test_data['y'],
        np.array([ticker_to_idx[ticker] for ticker in test_data['tickers']])
    )
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False)
    
    # Initialize metrics
    test_loss = 0
    predictions = []
    targets = []
    tickers = []
    
    # Evaluation loop
    criterion = nn.MSELoss()
    
    with torch.no_grad():
        for batch in test_loader:
            # Get batch data
            X_batch = batch['X'].to(device)
            y_batch = batch['y'].to(device).view(-1, 1)
            stock_indices = torch.LongTensor(batch['ticker']).to(device)
            
            # Forward pass
            outputs = model(X_batch, stock_indices, edge_index, edge_weight)
            
            # Calculate loss
            loss = criterion(outputs, y_batch)
            test_loss += loss.item()
            
            # Store predictions and targets
            predictions.extend(outputs.cpu().numpy())
            targets.extend(y_batch.cpu().numpy())
            tickers.extend(batch['ticker'].numpy())
    
    # Calculate average test loss
    test_loss /= len(test_loader)
    
    # Calculate test metrics
    predictions = np.array(predictions)
    targets = np.array(targets)
    rmse = np.sqrt(np.mean((predictions - targets) ** 2))
    mae = np.mean(np.abs(predictions - targets))
    
    # Calculate R^2 score
    mean_target = np.mean(targets)
    ss_tot = np.sum((targets - mean_target) ** 2)
    ss_res = np.sum((targets - predictions) ** 2)
    r2 = 1 - (ss_res / ss_tot)
    
    # Calculate stock-specific metrics
    stock_metrics = {}
    idx_to_ticker = {idx: ticker for ticker, idx in ticker_to_idx.items()}
    
    for idx in np.unique(tickers):
        mask = tickers == idx
        stock_preds = predictions[mask]
        stock_targets = targets[mask]
        
        stock_rmse = np.sqrt(np.mean((stock_preds - stock_targets) ** 2))
        stock_mae = np.mean(np.abs(stock_preds - stock_targets))
        
        stock_metrics[idx_to_ticker[idx]] = {
            'rmse': stock_rmse,
            'mae': stock_mae
        }
    
    return {
        'test_loss': test_loss,
        'rmse': rmse,
        'mae': mae,
        'r2': r2,
        'stock_metrics': stock_metrics,
        'predictions': predictions,
        'targets': targets
    }


def predict_next_day(model, data, ticker, sequence_length, ticker_to_idx, edge_index, edge_weight, 
                    scaler, device='cuda'):
    """
    Predict the next day's closing price for a specific stock
    
    Args:
        model: Trained THGNN model
        data: DataFrame with stock data
        ticker: Stock ticker to predict for
        sequence_length: Length of input sequence
        ticker_to_idx: Mapping from ticker to index
        edge_index: Graph edge index
        edge_weight: Graph edge weights
        scaler: Scaler used for normalization
        device: Device to predict on
        
    Returns:
        Predicted closing price
    """
    device = torch.device(device if torch.cuda.is_available() and device == 'cuda' else 'cpu')
    model = model.to(device)
    model.eval()
    
    # Convert edge index and weight to torch tensors
    edge_index = torch.LongTensor(edge_index).to(device)
    edge_weight = torch.FloatTensor(edge_weight).to(device)
    
    # Get the number of unique stocks in the dataset
    num_stocks = len(ticker_to_idx)
    
    # Ensure edge_index doesn't contain out-of-bounds indices
    mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
    edge_index = edge_index[:, mask]
    edge_weight = edge_weight[mask] if edge_weight is not None else None
    
    # Get the latest data for the ticker
    ticker_data = data[data['ticker'] == ticker].copy()
    
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
    
    # Extract features
    features = ['open', 'high', 'low', 'close', 'volume', 'rsi', 'macd', 'signal_line', 
               'price_change', 'avg_price', 'trading_range', 'price_volume_ratio']
    
    # Create input sequence
    X = ticker_data[features].values
    X = X.reshape(1, sequence_length, len(features))
    X = torch.FloatTensor(X).to(device)
    
    # Get stock index
    stock_idx = torch.LongTensor([ticker_to_idx[ticker]]).to(device)
    
    # Make prediction
    with torch.no_grad():
        prediction = model(X, stock_idx, edge_index, edge_weight)
    
    # Get the normalized prediction
    normalized_prediction = prediction.cpu().numpy()[0, 0]
    
    # Denormalize prediction using the data_utils function
    from data_utils import denormalize_predictions
    try:
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
        # Return only normalized prediction if denormalization fails
        return {
            'normalized': normalized_prediction,
            'denormalized': None
        }


############################
# 4. Main Execution Flow   #
############################

def main():
    """
    Main function to execute the workflow
    """
    # File paths
    stock_data_path = 'filtered_stocks.csv'
    relationship_data_path = 'stock_relationships.csv'
    save_dir = 'saved_model'
    
    # Check if saved model exists
    if os.path.exists(os.path.join(save_dir, 'model.pt')):
        print("Loading saved model...")
        model, inference_data = load_model(save_dir)
        
        # Load test data for evaluation
        print("Preprocessing data for evaluation...")
        preprocessed_data = preprocess_stock_data(
            stock_data_path=stock_data_path,
            relationship_data_path=relationship_data_path,
            sequence_length=10
        )
        
        # Get unique dates and sort them
        unique_dates = sorted(list(set(preprocessed_data['dates'])))
        
        # Use the last 20% for testing
        split_idx = int(len(unique_dates) * 0.8)
        test_dates = unique_dates[split_idx:]
        
        # Create test mask
        test_mask = np.isin(preprocessed_data['dates'], test_dates)
        
        # Create test data dictionary
        test_data = {
            'X': preprocessed_data['X'][test_mask],
            'y': preprocessed_data['y'][test_mask],
            'tickers': preprocessed_data['tickers'][test_mask],
            'dates': preprocessed_data['dates'][test_mask]
        }
        
        # Evaluate the model
        print("Evaluating model...")
        evaluation = evaluate_model(
            model=model,
            test_data=test_data,
            ticker_to_idx=inference_data['ticker_to_idx'],
            edge_index=inference_data['edge_index'],
            edge_weight=inference_data['edge_weight'],
            device='cuda'
        )
        
    else:
        # Preprocessing
        print("Preprocessing data...")
        preprocessed_data = preprocess_stock_data(
            stock_data_path=stock_data_path,
            relationship_data_path=relationship_data_path,
            sequence_length=10
        )
        
        # Train-test split with time-based validation
        # Get unique dates and sort them
        unique_dates = sorted(list(set(preprocessed_data['dates'])))
        
        # Use the last 20% for testing
        split_idx = int(len(unique_dates) * 0.8)
        train_dates = unique_dates[:split_idx]
        test_dates = unique_dates[split_idx:]
        
        # Split the data
        train_mask = np.isin(preprocessed_data['dates'], train_dates)
        test_mask = np.isin(preprocessed_data['dates'], test_dates)
        
        # Get the number of unique stocks
        num_stocks = len(preprocessed_data['ticker_to_idx'])
        
        # Ensure edge_index doesn't contain out-of-bounds indices
        edge_index = preprocessed_data['edge_index']
        edge_weight = preprocessed_data['edge_weight']
        mask = (edge_index[0] < num_stocks) & (edge_index[1] < num_stocks)
        preprocessed_data['edge_index'] = edge_index[:, mask]
        preprocessed_data['edge_weight'] = edge_weight[mask] if edge_weight is not None else None
        
        train_data = {
            'X': preprocessed_data['X'][train_mask],
            'y': preprocessed_data['y'][train_mask],
            'tickers': preprocessed_data['tickers'][train_mask],
            'dates': preprocessed_data['dates'][train_mask],
            'ticker_to_idx': preprocessed_data['ticker_to_idx'],
            'edge_index': preprocessed_data['edge_index'],
            'edge_weight': preprocessed_data['edge_weight'],
            'scalers': preprocessed_data['scalers']
        }
        
        test_data = {
            'X': preprocessed_data['X'][test_mask],
            'y': preprocessed_data['y'][test_mask],
            'tickers': preprocessed_data['tickers'][test_mask],
            'dates': preprocessed_data['dates'][test_mask]
        }
        
        # Train the model
        print("Training model...")
        model, history, train_dataset, val_dataset = train_thgnn_model(
            preprocessed_data=train_data,
            batch_size=128,
            epochs=50,
            lr=0.001,
            weight_decay=1e-5,
            hidden_dim=128,
            gnn_hidden_dim=64,
            gnn_type='gcn',
            device='cuda'
        )
        
        # Save the model
        save_model(model, history, preprocessed_data, train_dataset, val_dataset, test_data, save_dir)
        
        # Evaluate the model
        print("Evaluating model...")
        evaluation = evaluate_model(
            model=model,
            test_data=test_data,
            ticker_to_idx=preprocessed_data['ticker_to_idx'],
            edge_index=preprocessed_data['edge_index'],
            edge_weight=preprocessed_data['edge_weight'],
            device='cuda'
        )
    
    print(f"Test RMSE: {evaluation['rmse']:.4f}")
    print(f"Test MAE: {evaluation['mae']:.4f}")
    print(f"Test R²: {evaluation['r2']:.4f}")
    
    # Example: Predict next day's closing price for specific stocks
    for ticker in ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ITC']:
        try:
            prediction_result = predict_next_day(
                model=model,
                data=pd.read_csv(stock_data_path),
                ticker=ticker,
                sequence_length=10,
                ticker_to_idx=inference_data['ticker_to_idx'] if 'inference_data' in locals() else preprocessed_data['ticker_to_idx'],
                edge_index=inference_data['edge_index'] if 'inference_data' in locals() else preprocessed_data['edge_index'],
                edge_weight=inference_data['edge_weight'] if 'inference_data' in locals() else preprocessed_data['edge_weight'],
                scaler=inference_data['scalers'][ticker] if 'inference_data' in locals() else preprocessed_data['scalers'][ticker],
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


def save_model(model, history, preprocessed_data, train_data=None, val_data=None, test_data=None, save_dir='saved_model'):
    """
    Save the trained model, training history, datasets, and necessary data for inference
    
    Args:
        model: Trained THGNN model
        history: Training history
        preprocessed_data: Preprocessed data dictionary
        train_data: Training dataset
        val_data: Validation dataset
        test_data: Test dataset
        save_dir: Directory to save the model
    """
    # Create directory if it doesn't exist
    os.makedirs(save_dir, exist_ok=True)
    
    # Save model state
    torch.save(model.state_dict(), os.path.join(save_dir, 'model.pt'))
    
    # Save training history
    with open(os.path.join(save_dir, 'history.pkl'), 'wb') as f:
        pickle.dump(history, f)
    
    # Save essential data for inference
    essential_data = {
        'ticker_to_idx': preprocessed_data['ticker_to_idx'],
        'edge_index': preprocessed_data['edge_index'],
        'edge_weight': preprocessed_data['edge_weight'],
        'scalers': preprocessed_data['scalers']
    }
    with open(os.path.join(save_dir, 'inference_data.pkl'), 'wb') as f:
        pickle.dump(essential_data, f)
    
    # Save datasets if provided
    datasets = {}
    if train_data is not None:
        datasets['train'] = train_data
    if val_data is not None:
        datasets['val'] = val_data
    if test_data is not None:
        datasets['test'] = test_data
    
    if datasets:
        with open(os.path.join(save_dir, 'datasets.pkl'), 'wb') as f:
            pickle.dump(datasets, f)
        print(f"Model, data, and datasets saved to {save_dir}")
    else:
        print(f"Model and data saved to {save_dir}")


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
    
    # Initialize model (you need to know the dimensions)
    # For demonstration, we'll use default values
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


if __name__ == "__main__":
    main()