# Ritual Run Card Minter

This Foundry scaffold provides a simple mint contract with the frontend-compatible signature:

- `mintRunCard(string payload)`

## 1) Install Foundry dependency

From repo root:

```bash
forge install foundry-rs/forge-std
```

## 2) Build

```bash
forge build
```

## Security setup (recommended)

Copy the template and keep secrets local-only:

```bash
cp .env.example .env.local
```

`.env.local` is gitignored in this repo. Put `PRIVATE_KEY` there and never commit that file.

## 3) Deploy

Set env:

```bash
export PRIVATE_KEY=0x...
export MINT_OWNER=0x...
export MINT_FEE_WEI=0
export ETH_RPC_URL=https://...
```

Deploy:

```bash
forge script contracts/script/DeployRunCardMinter.s.sol:DeployRunCardMinter \
  --rpc-url "$ETH_RPC_URL" \
  --broadcast
```

## 4) Wire frontend env

Set these in your Vite env file (for example `.env.local`):

```bash
VITE_RITUAL_MINT_CONTRACT_ADDRESS=0xYourDeployedContract
VITE_RITUAL_MINT_METHOD_NAME=mintRunCard
VITE_RITUAL_MINT_CHAIN_ID=1979
```

`VITE_RITUAL_MINT_CHAIN_ID` should match your Ritual chain id.
