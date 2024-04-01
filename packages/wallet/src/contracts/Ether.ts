import { getAddress, type Address, isAddress, encodeFunctionData } from "viem";
import type { AdvanceRequestHandler, Voucher } from "@deroll/app";
import { cartesiDAppAbi } from "../rollups";
import { parseEtherDeposit } from "..";
import { CanHandler } from "../types";
import { Wallet } from "../wallet";
import { InsufficientBalanceError, NegativeAmountError } from "../errors";

interface BalanceOf {
    address: string;
    getWallet(address: string): Wallet;
}

interface Transfer {
    from: string;
    to: string;
    amount: bigint;
    getWallet(address: string): Wallet;
    setWallet(address: string, wallet: Wallet): void;
}

interface Withdraw {
    address: Address;
    amount: bigint;
    getWallet(address: string): Wallet;
    getDapp(): Address;
}

export class Ether implements CanHandler {
    balanceOf({ address, getWallet }: BalanceOf): bigint {
        if (isAddress(address)) {
            address = getAddress(address);
        }

        const wallet = getWallet(address);

        // ether balance
        return wallet?.ether ?? 0n;
    }
    transfer({ getWallet, from, to, amount, setWallet }: Transfer): void {
        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        if (amount < 0n) {
            throw new NegativeAmountError(amount);
        }
        if (walletFrom.ether < amount) {
            throw new InsufficientBalanceError(from, "ether", amount);
        }

        walletFrom.ether = walletFrom.ether - amount;
        walletTo.ether = walletTo.ether + amount;
        setWallet(from, walletFrom);
        setWallet(to, walletTo);
    }
    withdraw({ address, getWallet, amount, getDapp }: Withdraw): Voucher {
        // normalize address
        address = getAddress(address);

        const wallet = getWallet(address);

        const dapp = getDapp();

        // check balance
        if (amount < 0n) {
            throw new NegativeAmountError(amount);
        }
        if (wallet.ether < amount) {
            throw new InsufficientBalanceError(address, "ether", amount);
        }

        // reduce balance right away
        wallet.ether = wallet.ether - amount;

        // create voucher
        const call = encodeFunctionData({
            abi: cartesiDAppAbi,
            functionName: "withdrawEther",
            args: [address, amount],
        });
        return {
            destination: dapp, // dapp Address
            payload: call,
        };
    }

    handler: AdvanceRequestHandler = async ({ payload }) => {
        return "accept";
    };

    async deposit({ payload, setWallet, getWallet }: any): Promise<void> {
        const { sender, value } = parseEtherDeposit(payload);
        const wallet = getWallet(sender);
        wallet.ether += value;
        setWallet(sender, wallet);
    }
}

export const ether = new Ether();
