import { isERC1155SingleDeposit, parseERC1155SingleDeposit } from "."
import { inspect } from "node:util";
import { WalletAppImpl } from "./wallet";
import { AdvanceRequestData } from "@deroll/app";

export interface ERCHandler {
    isDeposit(data: any): boolean

    /**
     * Does not reject
     * @param data 
     */
    handle(data: AdvanceRequestData, wallets: WalletAppImpl): void
}

export class ERC1155Single implements ERCHandler {
    isDeposit(data: any): boolean {
        return isERC1155SingleDeposit(data)
    }

    handle(data: any, wallets: WalletAppImpl): void {
        console.log("ERC-1155 single");
        const { tokenId, sender, token, value } = parseERC1155SingleDeposit(
            data.payload,
        );

        const wallet = wallets.getWalletOrNew(sender);
        let collection = wallet.erc1155.get(token);
        if (!collection) {
            collection = new Map();
            wallet.erc1155.set(token, collection);
        }
        const tokenBalance = collection.get(tokenId) ?? 0n;
        collection.set(tokenId, tokenBalance + value);
        console.log(inspect(wallet));
    }

}
