import {
    type Address,
    getAddress,
    isAddress,
    encodeFunctionData,
    erc721Abi,
} from "viem";
import type { AdvanceRequestHandler, Voucher } from "@deroll/app";
import { parseERC721Deposit } from "..";
import { CanHandler } from "../types";
import { Wallet } from "../wallet";
import {
    TokenFromUserNotFound,
    InsufficientBalanceError,
    WithdrawWalletUndefinedError,
} from "../errors";

interface BalanceOf {
    owner: Address;
    getWallet(address: string): Wallet;
    address: string;
}

interface Transfer {
    from: Address;
    to: Address;
    getWallet(address: string): Wallet;
    setWallet(address: string, wallet: Wallet): void;
    token: Address;
    tokenId: bigint;
}

interface Withdraw {
    token: Address;
    address: Address;
    getWallet(address: string): Wallet;
    setWallet(address: string, wallet: Wallet): void;
    tokenId: bigint;
    getDapp(): Address;
}

export class ERC721 implements CanHandler {
    balanceOf({ owner, getWallet, address }: BalanceOf): bigint {
        const ownerAddress = getAddress(owner);
        const wallet = getWallet(ownerAddress);
        if (isAddress(address)) {
            address = getAddress(address);
        }
        const size = wallet.erc721[address]?.size ?? 0n;
        return BigInt(size);
    }
    transfer({
        from,
        to,
        getWallet,
        setWallet,
        token,
        tokenId,
    }: Transfer): void {
        token = getAddress(token);

        // normalize addresses
        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        const balance = walletFrom.erc721[token];

        if (!balance) {
            throw new InsufficientBalanceError(from, token, tokenId);
        }

        if (!balance.has(tokenId)) {
            throw new TokenFromUserNotFound(from, token, tokenId);
        }

        let balanceTo = walletTo.erc721[token];
        if (!balanceTo) {
            balanceTo = new Set();
            walletTo.erc721[token] = balanceTo;
        }
        balanceTo.add(tokenId);
        balance.delete(tokenId);

        setWallet(from, walletFrom);
        setWallet(to, walletTo);
    }
    withdraw({
        token,
        address,
        getWallet,
        tokenId,
        getDapp,
    }: Withdraw): Voucher {
        token = getAddress(token);
        address = getAddress(address);

        const wallet = getWallet(address);

        if (!wallet) {
            throw new WithdrawWalletUndefinedError(address);
        }

        const collection = wallet.erc721[token];
        if (!collection.has(tokenId)) {
            throw new InsufficientBalanceError(address, token, 1n, tokenId);
        }
        const dappAddress = getDapp();

        collection.delete(tokenId);
        const call = encodeFunctionData({
            abi: erc721Abi,
            functionName: "safeTransferFrom",
            args: [dappAddress, address, tokenId],
        });
        return {
            destination: token,
            payload: call,
        };
    }

    handler: AdvanceRequestHandler = async (data) => {
        return "accept"
    }
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: any): Promise<void> {
        const { token, sender, tokenId } = parseERC721Deposit(payload);

        const wallet = getWallet(sender);

        const collection = wallet.erc721[token];
        if (collection) {
            collection.add(tokenId);
        } else {
            const collection = new Set([tokenId]);
            wallet.erc721[token] = collection;
        }
        setWallet(sender, wallet);
    }
}

export const erc721 = new ERC721();
