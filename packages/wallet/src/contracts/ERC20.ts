import {
    getAddress,
    type Address,
    isAddress,
    encodeFunctionData,
    erc20Abi,
} from "viem";
import type { AdvanceRequestHandler, Voucher } from "@deroll/app";
import { parseERC20Deposit } from "..";
import { CanHandler } from "../types";
import { Wallet } from "../wallet";
import { InsufficientBalanceError, NegativeAmountError } from "../errors";

interface BalanceOf {
    address: string;
    getWallet(address: string): Wallet;
    tokenOrAddress: string;
}

interface Transfer {
    token: Address;
    from: string;
    to: string;
    amount: bigint;
    getWallet(address: string): Wallet;
    setWallet(address: string, wallet: Wallet): void;
}

interface Withdraw {
    token: Address;
    address: Address;
    getWallet(address: string): Wallet;
    amount: bigint;
}

export class ERC20 implements CanHandler {
    balanceOf({ address, getWallet, tokenOrAddress }: BalanceOf): bigint {
        const addr = getAddress(address);

        const erc20address = getAddress(tokenOrAddress);
        const wallet = getWallet(addr);
        const result = wallet.erc20[erc20address] ?? 0n;
        return result;
    }
    transfer({
        token,
        from,
        to,
        amount,
        getWallet,
        setWallet,
    }: Transfer): void {
        // normalize addresses
        token = getAddress(token);

        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        const balance = walletFrom.erc20[token];

        if (amount < 0n) {
            throw new NegativeAmountError(amount);
        }
        if (!balance || balance < amount) {
            throw new InsufficientBalanceError(from, token, amount);
        }

        const balanceFrom = balance - amount;
        walletFrom.erc20[token] = balanceFrom;

        const balanceTo = walletTo.erc20[token];

        if (balanceTo) {
            walletTo.erc20[token] = balanceTo + amount;
        } else {
            walletTo.erc20[token] = amount;
        }

        setWallet(from, walletFrom);
        setWallet(to, walletTo);
    }
    withdraw({ token, address, getWallet, amount }: Withdraw): Voucher {
        // normalize addresses
        token = getAddress(token);
        address = getAddress(address);

        const wallet = getWallet(address);

        const balance = wallet.erc20[token];

        // check balance
        if (amount < 0n) {
            throw new NegativeAmountError(amount);
        }
        if (!balance || balance < amount) {
            throw new InsufficientBalanceError(address, token, amount);
        }

        // reduce balance right away
        wallet.erc20[token] = balance - amount;

        const call = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [address, amount],
        });

        // create voucher to the ERC-20 transfer
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
        getWallet,
        setWallet,
    }: any): Promise<void> {
        const { success, token, sender, amount } = parseERC20Deposit(payload);
        if (success) {
            const wallet = getWallet(sender);

            const balance = wallet.erc20[token];

            if (balance) {
                wallet.erc20[token] = balance + amount;
            } else {
                wallet.erc20[token] = amount;
            }

            setWallet(sender, wallet);
        }
    }
}

export const erc20 = new ERC20();
