import {
    getAddress,
    type Address,
    isHex,
    isAddress,
    encodeFunctionData,
    erc20Abi,
} from "viem";
import type { Voucher } from "@deroll/app";
import { erc20PortalAddress } from "../rollups";
import { parseERC20Deposit } from "..";
import { DepositArgs, DepositOperation } from "../token";
import { Wallet } from "../wallet";

interface BalanceOf {
    address: string;
    getWallet(address: string): Wallet;
    tokenOrAddress: string;
}

interface Transfer {
    token: Address;
    from: Address;
    to: Address;
    amount: bigint;
    getWallet(address: Address): Wallet;
    setWallet(address: Address, wallet: Wallet): void;
}

interface Withdraw {
    token: Address;
    address: Address;
    getWallet(address: Address): Wallet;
    amount: bigint;
}

export class ERC20 implements DepositOperation {
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
        if (isAddress(from)) {
            from = getAddress(from);
        }
        if (isAddress(to)) {
            to = getAddress(to);
        }

        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        const balance = walletFrom.erc20[token];

        if (!balance || balance < amount) {
            throw new Error(
                `insufficient balance of user ${from} of token ${token}`,
            );
        }

        const balanceFrom = balance - amount;
        walletFrom.erc20[token] = balanceFrom;

        const balanceTo = walletTo.erc20[token];

        if (balanceTo) {
            walletTo.erc20[token] = balanceTo + amount;
        } else {
            walletTo.erc20[token] = amount;
        }

        setWallet(from as Address, walletFrom);
        setWallet(to as Address, walletTo);
    }
    withdraw({ token, address, getWallet, amount }: Withdraw): Voucher {
        // normalize addresses
        token = getAddress(token);
        address = getAddress(address);

        const wallet = getWallet(address);

        if (!wallet) {
            throw new Error(`wallet of user ${address} is undefined`);
        }

        const balance = wallet.erc20[token];

        // check balance
        if (!balance || balance < amount) {
            throw new Error(
                `insufficient balance of user ${address} of token ${token}: ${amount.toString()} > ${
                    balance?.toString() ?? "0"
                }`,
            );
        }

        // reduce balance right away
        wallet.erc20[token] = balance - amount;

        const call = encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [address as Address, amount],
        });

        // create voucher to the ERC-20 transfer
        return {
            destination: token,
            payload: call,
        };
    }
    async deposit({
        payload,
        getWallet,
        setWallet,
    }: DepositArgs): Promise<void> {
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
    isDeposit(msgSender: Address): boolean {
        return msgSender === erc20PortalAddress;
    }
}

export const erc20 = new ERC20();
