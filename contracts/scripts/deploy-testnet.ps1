$ErrorActionPreference = "Stop"
$env:Path = "$env:USERPROFILE\.cargo\bin;C:\Program Files (x86)\Stellar CLI;" + $env:Path

# Load secrets from backend/.env without ever printing them
$envMap = @{}
Get-Content "d:\live\nexus-rail\backend\.env" | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        $envMap[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$hotSecret = $envMap["STELLAR_HOT_WALLET_SECRET"]
$issuerSecret = $envMap["STELLAR_NR_ISSUER_SECRET"]
if (-not $hotSecret -or -not $issuerSecret) {
    throw "Missing STELLAR_HOT_WALLET_SECRET or STELLAR_NR_ISSUER_SECRET in backend/.env"
}

$adminPub   = "GDXPDDOVJRPP4UKRSYJUABBR4WKNBHS3STNK5TGXJ6RNXTGDDZ5ORXGC"
$reservePub = "GB24JBHL5EIZPUJPGPT67W6BDSEWY2SJU4I2UOV3RAZ4DG4HLLBJRAOZ"
$xlmSac     = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"
$nxlSac     = "CDGPJNW7T53P3L5X7LLVMIAPMVIYT7GNC3EVV3ZOGFVCMWQSW2HF7LPC"

$vaultWasm = "d:\live\nexus-rail\contracts\target\wasm32v1-none\release\nexus_vault.wasm"
$swapWasm  = "d:\live\nexus-rail\contracts\target\wasm32v1-none\release\nexus_swap.wasm"

Write-Host "==> 1. Deploying NexusVault v2.0 to Stellar Testnet..." -ForegroundColor Cyan
$vaultId = (& stellar contract deploy `
    --wasm $vaultWasm `
    --source-account $hotSecret `
    --network testnet `
    -- `
    --admin $adminPub `
    --relayer $adminPub `
    --pauser $adminPub `
    --treasury $adminPub `
    --nr_reserve $reservePub `
    --nxl_token $nxlSac `
    --order_fee_bps 100 `
    --owner_split_pct 50 `
    --nxl_supply_cap 20000000000000 `
    --initial_circulating_nxl 10000000000000).Trim()

Write-Host "NEXUS_VAULT_CONTRACT_ID=$vaultId" -ForegroundColor Green

Write-Host "==> 2. Deploying NexusSwap AMM & Bridge Escrow v2.0 to Stellar Testnet..." -ForegroundColor Cyan
$swapId = (& stellar contract deploy `
    --wasm $swapWasm `
    --source-account $hotSecret `
    --network testnet `
    -- `
    --admin $adminPub `
    --relayer $adminPub `
    --treasury $adminPub `
    --token_a $xlmSac `
    --token_b $nxlSac `
    --swap_fee_bps 50 `
    --owner_fee_split_pct 50).Trim()

Write-Host "NEXUS_SWAP_CONTRACT_ID=$swapId" -ForegroundColor Green

Write-Host "==> 3. Authorizing NexusVault as $NXL SAC Admin (for supply-capped mint)..." -ForegroundColor Cyan
& stellar contract invoke `
    --id $nxlSac `
    --source-account $issuerSecret `
    --network testnet `
    -- `
    set_admin `
    --new_admin $vaultId

Write-Host "==> 4. Seeding NexusSwap AMM Pool (2,000 XLM + 2,000 NXL)..." -ForegroundColor Cyan
& stellar contract invoke `
    --id $swapId `
    --source-account $hotSecret `
    --network testnet `
    -- `
    add_liquidity `
    --provider $adminPub `
    --amount_a 20000000000 `
    --amount_b 20000000000 `
    --min_shares 1

Write-Host "==> 5. Verifying live on-chain state..." -ForegroundColor Cyan
Write-Host "--- NexusVault get_config ---"
& stellar contract invoke --id $vaultId --source-account $hotSecret --network testnet --send=no -- get_config
Write-Host "--- NexusVault get_metrics ---"
& stellar contract invoke --id $vaultId --source-account $hotSecret --network testnet --send=no -- get_metrics
Write-Host "--- NexusSwap get_pool_state ---"
& stellar contract invoke --id $swapId --source-account $hotSecret --network testnet --send=no -- get_pool_state
Write-Host "--- NexusSwap live quote (10 XLM -> NXL) ---"
& stellar contract invoke --id $swapId --source-account $hotSecret --network testnet --send=no -- quote_swap --token_in $xlmSac --amount_in 100000000

Write-Host "DONE! Deployed successfully to Stellar Testnet." -ForegroundColor Green
