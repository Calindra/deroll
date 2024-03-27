import {
    getAddress,
    type Address,
    isHex,
    isAddress,
    encodeFunctionData,
} from "viem";
import type { Voucher } from "@deroll/app";
import { cartesiDAppAbi, etherPortalAddress } from "../rollups";
import { parseEtherDeposit } from "..";
import { DepositArgs, DepositOperation } from "../token";
import { Wallet } from "../wallet";

interface BalanceOf {
    tokenOrAddress: string;
    getWallet(address: string): Wallet;
}

interface Transfer {
    from: Address;
    to: Address;
    amount: bigint;
    getWallet(address: Address): Wallet;
    setWallet(address: Address, wallet: Wallet): void;
}

interface Withdraw {
    address: Address;
    amount: bigint;
    getWallet(address: Address): Wallet;
    getDapp(): Address;
}

export class Ether implements DepositOperation {
    balanceOf({ tokenOrAddress, getWallet }: BalanceOf): bigint {
        if (isAddress(tokenOrAddress)) {
            tokenOrAddress = getAddress(tokenOrAddress);
        }

        const wallet = getWallet(tokenOrAddress as Address);

        // ether balance
        return wallet?.ether ?? 0n;
    }
    transfer({ getWallet, from, to, amount, setWallet }: Transfer): void {
        const walletFrom = getWallet(from);
        const walletTo = getWallet(to);

        if (walletFrom.ether < amount) {
            throw new Error(`insufficient balance of user ${from}`);
        }

        walletFrom.ether = walletFrom.ether - amount;
        walletTo.ether = walletTo.ether + amount;
        setWallet(from as Address, walletFrom);
        setWallet(to as Address, walletTo);
    }
    withdraw({ address, getWallet, amount, getDapp }: Withdraw): Voucher {
        // normalize address
        address = getAddress(address);

        const wallet = getWallet(address);

        if (!wallet) {
            throw new Error(`wallet of user ${address} is undefined`);
        }

        const dapp = getDapp();

        // check if dapp address is defined
        if (!dapp) {
            throw new Error(`undefined application address`);
        }

        // check balance
        if (wallet.ether < amount) {
            throw new Error(
                `insufficient balance of user ${address}: ${amount.toString()} > ${wallet.ether.toString()}`,
            );
        }

        // reduce balance right away
        wallet.ether = wallet.ether - amount;

        // create voucher
        const call = encodeFunctionData({
            abi: cartesiDAppAbi,
            functionName: "withdrawEther",
            args: [address as Address, amount],
        });
        return {
            destination: dapp, // dapp Address
            payload: call,
        };
    }
    isDeposit(msgSender: Address): boolean {
        return msgSender === etherPortalAddress;
    }
    async deposit({
        payload,
        setWallet,
        getWallet,
    }: DepositArgs): Promise<void> {
        const { sender, value } = parseEtherDeposit(payload);
        const wallet = getWallet(sender);
        wallet.ether += value;
        setWallet(sender, wallet);
    }
}

export const ether = new Ether();
