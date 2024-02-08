import type { Abi } from "abitype";
import { defineConfig } from "@wagmi/cli";
import { erc } from "@wagmi/cli/plugins";
import hardhatDeploy from "@sunodo/wagmi-plugin-hardhat-deploy";
// @ts-ignore
import CartesiDApp from "@cartesi/rollups/export/artifacts/contracts/dapp/CartesiDApp.sol/CartesiDApp.json" assert { type: "json" };

export default defineConfig({
    out: "src/rollups.ts",
    contracts: [
        {
            name: CartesiDApp.contractName,
            abi: CartesiDApp.abi as Abi,
        },
    ],
    plugins: [
        erc({ 721: true, 4626: false }),
        hardhatDeploy({
            directory: "node_modules/@cartesi/rollups/export/abi",
            includes: [
                /CartesiDApp/,
                /DAppAddressRelay/,
                /ERC20Portal/,
                /EtherPortal/,
            ],
        }),
    ],
});
