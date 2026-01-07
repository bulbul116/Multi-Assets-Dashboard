const API_KEY = "PASTE_YOUR_MORALIS_API_KEY_HERE";

const CHAINS = [
  { name: "Ethereum", chain: "eth" },
  { name: "BNB Smart Chain", chain: "bsc" },
  { name: "Polygon", chain: "polygon" },
  { name: "Arbitrum", chain: "arbitrum" },
  { name: "Optimism", chain: "optimism" },
  { name: "Avalanche", chain: "avalanche" },
  { name: "Base", chain: "base" }
];

async function scanWallet() {
  const address = document.getElementById("wallet").value;
  const results = document.getElementById("results");
  const loader = document.getElementById("loader");

  if (!address.startsWith("0x")) {
    alert("Enter a valid EVM address");
    return;
  }

  results.innerHTML = "";
  loader.classList.remove("hidden");

  for (const net of CHAINS) {
    try {
      const res = await fetch(
        `https://deep-index.moralis.io/api/v2/${address}/erc20?chain=${net.chain}&price=true`,
        { headers: { "X-API-Key": API_KEY } }
      );

      const tokens = await res.json();
      let html = "";

      tokens.forEach(t => {
        const balance = t.balance / (10 ** t.decimals);
        const usd = balance * (t.usd_price || 0);
        if (usd >= 0.01) {
          html += `
            <div class="token">
              <span>${t.symbol}</span>
              <span>$${usd.toFixed(2)}</span>
            </div>
          `;
        }
      });

      if (html) {
        results.innerHTML += `
          <div class="network">
            <h3>${net.name}</h3>
            ${html}
          </div>
        `;
      }

    } catch (err) {
      console.error(net.name, err);
    }
  }

  loader.classList.add("hidden");
}
