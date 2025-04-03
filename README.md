# THGNN_grp13

# THGNN Stock Predictor

Welcome to the THGNN Stock Predictor project! This repository implements a Temporal Heterogeneous Graph Neural Network (THGNN) for stock price prediction, integrated with an interactive React-based frontend dashboard. This README provides step-by-step instructions to set up the project, install dependencies, and download the required data.


## Prerequisites

### System Requirements
- **Node.js**: Version 14.x or higher (for the frontend).
- **Python**: Version 3.8 or higher (for the backend).
- **npm**: Included with Node.js installation.
- **pip**: Python package manager (usually included with Python).
- **Git**: For cloning the repository.


## Installation


1. **Clone the Repository**
   ```bash
   git clone https://github.com/Shresth-k/THGNN_grp13.git
   ```

2. **Install Node.js Dependencies**
   Navigate to the project root directory and install the required npm packages:
   ```bash
   npm install
   ```
   The following key dependencies will be installed (check `package.json` for the exact versions):
   - `react`: For building the user interface.
   - `react-dom`: For rendering React components.
   - `lucide-react`: For icons used in the dashboard.
   - `lightweight-charts`: For rendering stock charts.
   - `react-select`: For the dropdown menu to select stocks.
   - `axios`: For making API requests to the backend.
   - `d3`: For the network graph visualization.
   - `papaparse`: For parsing CSV data.

### Backend Setup (Python)

1. **Navigate to the Backend Directory**
   ```bash
   cd src/backend
   ```

2. **Install Python Dependencies**
   Install the required Python libraries using pip:
   ```bash
   pip install torch torchvision torchaudio
   pip install torch-geometric
   pip install numpy pandas sklearn matplotlib seaborn networkx tqdm pickle
   ```
   The key libraries include:
   - `torch`: For the PyTorch deep learning framework.
   - `torch-geometric`: For graph neural network operations.
   - `numpy`: For numerical computations.
   - `pandas`: For data manipulation and CSV handling.
   - `sklearn`: For preprocessing (e.g., StandardScaler).
   - `matplotlib` and `seaborn`: For data visualization.
   - `networkx`: For graph construction.
   - `tqdm`: For progress bars during training.
   - `pickle`: For saving and loading model data.


## Downloading Data

The project requires several data files to function. Download them from the following sources and place them in the specified directories:

1. **Filtered Stocks Data**
   - **Source**: [link](https://drive.google.com/file/d/1Ss4VLyU2D7QKM_nFXnvMNZ2lIZDMYp5z/view?usp=drive_link) under `src/backend/filtered_stocks.csv`
   - **Instructions**: Clone the repository (as done in the frontend setup) to automatically include this file in `src/backend/`. If missing, download it manually from the repository and place it in `src/backend/`.

2. **Normalized Stock Data**
   - **Source**: [https://drive.google.com/file/d/1NDjdR-V-1cahmyUG4M9h_LlPaJtjqXWw/view?usp=drive_link](https://drive.google.com/file/d/1NDjdR-V-1cahmyUG4M9h_LlPaJtjqXWw/view?usp=drive_link)
   - **Instructions**: 
     - Click the link and select "Download" to get the file (`normalized_stock_data.csv`).
     - Place it in `src/backend/data_storage/normalized/`. Create the `normalized` directory if it doesn’t exist.

3. **Original Stock Data**
   - **Source**: [https://drive.google.com/file/d/1EVf2SH-I8S4LA0ob3CsIZEonOme9kHLc/view?usp=drive_link](https://drive.google.com/file/d/1EVf2SH-I8S4LA0ob3CsIZEonOme9kHLc/view?usp=drive_link)
   - **Instructions**: 
     - Click the link and select "Download" to get the file (`original_stock_data.csv`).
     - Place it in `src/backend/data_storage/original/`. Create the `original` directory if it doesn’t exist.


**Note**: Ensure the directory structure matches `src/backend/data_storage/normalized/` and `src/backend/data_storage/original/` for the model to locate the files correctly.

## Running the Project

### Backend
1. **Start the Python Server**
   Navigate to the backend directory and run the prediction server:
   ```bash
   cd src/backend
   python app.py
   ```
   This assumes an `app.py` file is present to handle API requests (e.g., `http://localhost:5000/api/prediction/${stockSymbol}`). Modify the script if the endpoint differs.

### Frontend
1. **Start the React Application**
   From the frontend directory, start the development server:
   ```bash
   npm start
   ```

2. **Verify Functionality**
   - Ensure the stock chart loads with the default stock (ADANIENT).
   - Check that predictions and other visualizations appear without errors.
