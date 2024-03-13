import { MissingContextArgumentError } from "../errors";
import {
    type Address,
    isHex
} from "viem";
import { erc721PortalAddress } from "../rollups";
import { parseERC721Deposit } from "..";
import { TokenOperation, TokenContext } from "../token";

export class ERC721 implements TokenOperation {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    balanceOf<T extends bigint | bigint[]>(context: TokenContext): T {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    transfer(context: TokenContext): Promise<void> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    withdraw(context: TokenContext): { destination: Address; payload: string; } {
        throw new Error("Method not implemented.");
    }
    async deposit({
        payload, setWallet, getWallet,
    }: TokenContext): Promise<void> {
        console.log("ERC-721 data");

        if (!payload || !isHex(payload) || !setWallet || !getWallet) {
            throw new MissingContextArgumentError<TokenContext>({
                payload,
                setWallet,
                getWallet,
            });
        }

        const { token, sender, tokenId } = parseERC721Deposit(payload);

        const wallet = getWallet(sender);

        const collection = wallet.erc721.get(token);
        if (collection) {
            collection.add(tokenId);
        } else {
            const collection = new Set([tokenId]);
            wallet.erc721.set(token, collection);
        }
        setWallet(sender, wallet);
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc721PortalAddress;
    }
}
