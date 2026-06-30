# Re-sync the shop from Shopify, then regenerate the static pages.
# Usage:  powershell -File build-shop.ps1   (run from the repo root)
# Then commit + push. The Storefront token below is the PUBLIC publishable
# token (safe to expose) — NOT the Admin/Printful secret.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = $PSScriptRoot

$headers = @{ "X-Shopify-Storefront-Access-Token" = "1032480366b6bf67760ba73ace4fe0f8"; "Content-Type" = "application/json" }
$q = '{ "query": "{ products(first: 50) { edges { node { handle title descriptionHtml productType featuredImage { url altText } images(first: 30) { edges { node { url altText } } } options { name values } priceRange { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } } variants(first: 120) { edges { node { id title availableForSale price { amount currencyCode } selectedOptions { name value } image { url altText } } } } } } } }" }'

Write-Host "Fetching products from Shopify Storefront API..."
$r = Invoke-RestMethod -Uri "https://officialdancingbanana.myshopify.com/api/2024-10/graphql.json" -Method Post -Headers $headers -Body $q
$out = Join-Path $root "shop\products.json"
$r | ConvertTo-Json -Depth 40 | Out-File -FilePath $out -Encoding utf8
Write-Host ("Saved " + $r.data.products.edges.Count + " product(s) to shop/products.json")

Write-Host "Generating static shop pages..."
python (Join-Path $root "build-shop.py")
Write-Host "Done. Review, then commit + push."
