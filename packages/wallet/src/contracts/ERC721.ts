import {
    type Address,
    isHex,
    getAddress,
    isAddress,
    encodeFunctionData,
    erc721Abi,
} from "viem";
import type { Voucher } from "@deroll/app";
import { erc721PortalAddress } from "../rollups";
import { parseERC721Deposit } from "..";
import { DepositArgs, DepositOperation } from "../token";
import { Wallet } from "../wallet";

interface BalanceOf {
    owner: Address;
    getWallet(address: string): Wallet
    address: string;
}

interface Transfer {
    from: Address;
    to: Address;
    getWallet(address: string): Wallet
    setWallet(address: string, wallet: Wallet): void;
    token: Address;
    tokenId: bigint;
}

interface Withdraw {
    token: Address;
    address: Address;
    getWallet(address: string): Wallet
    setWallet(address: string, wallet: Wallet): void;
    tokenId: bigint;
    getDapp(): Address;
}

export class ERC721 implements DepositOperation {
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
            throw new Error(
                `insufficient balance of user ${from} of token ${token}`,
            );
        }

        if (!balance.has(tokenId)) {
            throw new Error(
                `user ${from} does not have token ${tokenId} of token ${token}`,
            );
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
            throw new Error(`wallet of user ${address} is undefined`);
        }

        const collection = wallet?.erc721[token];
        if (!collection) {
            throw new Error(
                `insufficient balance of user ${address} of token ${token}`,
            );
        }
        if (!collection.has(tokenId)) {
            throw new Error(
                `insufficient balance of user ${address} of token ${token} id ${tokenId}`,
            );
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
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: DepositArgs): Promise<void> {
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
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc721PortalAddress;
    }
}

export const erc721 = new ERC721();
