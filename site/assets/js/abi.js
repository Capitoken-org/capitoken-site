window.CAPI_ABI = [
  { "constant": true, "inputs": [], "name": "name", "outputs": [{"name":"","type":"string"}], "stateMutability": "view", "type": "function" },
  { "constant": true, "inputs": [], "name": "symbol", "outputs": [{"name":"","type":"string"}], "stateMutability": "view", "type": "function" },
  { "constant": true, "inputs": [], "name": "decimals", "outputs": [{"name":"","type":"uint8"}], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "currentDay", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view", "type":"function" },
  { "inputs": [], "name": "unlockedCommunitySupply", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability":"view", "type":"function" },
  { "inputs": [], "name": "availableForSale", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "circulatingSupply", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "rewardsVestingEnd", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "launchTime", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType":"address","name":"","type":"address"}], "name": "lockedRewards", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [], "name": "buy", "outputs": [], "stateMutability": "payable", "type": "function" },
  { "inputs": [], "name": "claimRewards", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "anonymous": false, "inputs": [
      {"indexed": true, "internalType": "address", "name": "buyer", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "ethSpent", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "tokensBought", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "rewardLocked", "type": "uint256"}
    ], "name": "TokensPurchased", "type": "event" }
];

// ABI mínima de un par Uniswap V2 (para getReserves)
window.PAIR_ABI = [
  {"constant":true,"inputs":[],"name":"getReserves","outputs":[
    {"internalType":"uint112","name":"_reserve0","type":"uint112"},
    {"internalType":"uint112","name":"_reserve1","type":"uint112"},
    {"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}
  ],"stateMutability":"view","type":"function"},
  {"constant":true,"inputs":[],"name":"token0","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"},
  {"constant":true,"inputs":[],"name":"token1","outputs":[{"type":"address"}],"stateMutability":"view","type":"function"}
];
