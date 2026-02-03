const CHAINS = [
  {
    chainId: 1,
    chainName: "Ethereum",
    chainType: "EVM",
    nativeSymbol: "ETH",
    moralisChain: "eth"
  },
  {
    chainId: 56,
    chainName: "BNB Chain",
    chainType: "EVM",
    nativeSymbol: "BNB",
    moralisChain: "bsc"
  },
  {
    chainId: 137,
    chainName: "Polygon",
    chainType: "EVM",
    nativeSymbol: "MATIC",
    moralisChain: "polygon"
  },
  {
    chainId: 42161,
    chainName: "Arbitrum",
    chainType: "EVM",
    nativeSymbol: "ETH",
    moralisChain: "arbitrum"
  },
  {
    chainId: 10,
    chainName: "Optimism",
    chainType: "EVM",
    nativeSymbol: "ETH",
    moralisChain: "optimism"
  },
  {
    chainId: 8453,
    chainName: "Base",
    chainType: "EVM",
    nativeSymbol: "ETH",
    moralisChain: "base"
  },
  {
    chainId: 43114,
    chainName: "Avalanche",
    chainType: "EVM",
    nativeSymbol: "AVAX",
    moralisChain: "avalanche"
  },
  {
    chainId: 101,
    chainName: "Solana",
    chainType: "NON_EVM",
    nativeSymbol: "SOL",
    moralisChain: null
  },
  {
    chainId: 195,
    chainName: "Tron",
    chainType: "NON_EVM",
    nativeSymbol: "TRX",
    moralisChain: null
  },
  {
    chainId: 0,
    chainName: "Bitcoin",
    chainType: "NON_EVM",
    nativeSymbol: "BTC",
    moralisChain: null
  }
];

const defaultExport = {
  wallet: "",
  scan_timestamp: "",
  total_value_usd: 0,
  chains: [],
  assets: [],
  nfts: []
};

const DUST_USD_THRESHOLD = 0.01;

const resultsEl = document.getElementById("results");
const timestampInput = document.getElementById("scanTimestamp");

const nowIso = () => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");

timestampInput.value = nowIso();

function formatExport(data) {
  return JSON.stringify(data, null, 2);
}

function renderExport(data) {
  resultsEl.textContent = formatExport(data);
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function buildAssetId({ wallet, chainId, contractAddress, symbol }) {
  const contract = contractAddress || "native";
  return `${wallet}:${chainId}:${contract}:${symbol}`;
}

async function fetchMoralisTokens({ address, apiKey, moralisChain }) {
  const response = await fetch(
    `https://deep-index.moralis.io/api/v2/${address}/erc20?chain=${moralisChain}&price=true`,
    { headers: { "X-API-Key": apiKey } }
  );

  if (!response.ok) {
    throw new Error(`Moralis error ${response.status}`);
  }

  return response.json();
}

async function scanWallet() {
  const address = document.getElementById("wallet").value.trim();
  const scanTimestamp = timestampInput.value.trim() || nowIso();
  const apiKey = document.getElementById("apiKey").value.trim();
  const loader = document.getElementById("loader");
  const button = document.getElementById("scanButton");

  if (!address) {
    alert("Enter a wallet address to scan");
    return;
  }

  const exportPayload = {
    ...defaultExport,
    wallet: address,
    scan_timestamp: scanTimestamp
  };

  loader.classList.remove("hidden");
  button.disabled = true;

  const chainResults = await Promise.all(
    CHAINS.map(async (chain) => {
      if (!chain.moralisChain) {
        return {
          chain,
          status: "inactive",
          assets: []
        };
      }

      if (!apiKey) {
        return {
          chain,
          status: "inactive",
          assets: []
        };
      }

      try {
        const tokens = await fetchMoralisTokens({
          address,
          apiKey,
          moralisChain: chain.moralisChain
        });

        const assets = tokens.map((token) => {
          const decimals = parseNumber(token.decimals || 0);
          const balance = decimals
            ? parseNumber(token.balance) / Math.pow(10, decimals)
            : parseNumber(token.balance || 0);
          const priceUsd = parseNumber(token.usd_price);
          const valueUsd = balance * priceUsd;
          const isDust = valueUsd > 0 && valueUsd < DUST_USD_THRESHOLD;

          return {
            asset_id: buildAssetId({
              wallet: address,
              chainId: chain.chainId,
              contractAddress: token.token_address,
              symbol: token.symbol
            }),
            wallet: address,
            chain_id: chain.chainId,
            chain_name: chain.chainName,
            asset_type: "erc20",
            name: token.name || token.symbol || "Unknown",
            symbol: token.symbol || "",
            contract_address: token.token_address || null,
            decimals,
            balance: balance.toString(),
            price_usd: priceUsd,
            value_usd: valueUsd,
            price_change_24h: token.usd_price_24hr_percent_change ?? null,
            logo_url: token.logo || null,
            is_verified: Boolean(token.verified_contract),
            is_spam: Boolean(token.possible_spam) || isDust,
            data_source: "Moralis"
          };
        });

        return {
          chain,
          status: "active",
          assets
        };
      } catch (error) {
        console.error(chain.chainName, error);
        return {
          chain,
          status: "inactive",
          assets: []
        };
      }
    })
  );

  chainResults.forEach(({ chain, status, assets }) => {
    if (status === "inactive") {
      exportPayload.chains.push({
        chain_id: chain.chainId,
        chain_name: chain.chainName,
        chain_type: chain.chainType,
        native_symbol: chain.nativeSymbol,
        native_balance: "0",
        native_price_usd: 0,
        native_value_usd: 0,
        rpc_status: "inactive",
        data_source: chain.moralisChain ? "Moralis" : "Unavailable"
      });
      return;
    }

    if (assets.length === 0) {
      return;
    }

    exportPayload.chains.push({
      chain_id: chain.chainId,
      chain_name: chain.chainName,
      chain_type: chain.chainType,
      native_symbol: chain.nativeSymbol,
      native_balance: "0",
      native_price_usd: 0,
      native_value_usd: 0,
      rpc_status: "active",
      data_source: "Moralis"
    });

    exportPayload.assets.push(...assets);
  });

  const assetTotal = exportPayload.assets.reduce(
    (total, asset) => total + parseNumber(asset.value_usd),
    0
  );
  const nftTotal = exportPayload.nfts.reduce(
    (total, nft) => total + parseNumber(nft.estimated_value_usd),
    0
  );
  exportPayload.total_value_usd = assetTotal + nftTotal;

  renderExport(exportPayload);
  loader.classList.add("hidden");
  button.disabled = false;
}

function copyExport() {
  const data = resultsEl.textContent;
  navigator.clipboard.writeText(data).then(
    () => {
      alert("Export JSON copied to clipboard");
    },
    () => {
      alert("Unable to copy. Please copy manually.");
    }
  );
}

renderExport(defaultExport);
