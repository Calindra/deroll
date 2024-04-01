import {
    getAddress} from "viem";
import type { AdvanceRequestHandler } from "@deroll/app";
import { CanHandler } from "../types";

export class Relay implements CanHandler {
    handler: AdvanceRequestHandler = async (data) => {
        return "accept"
    }

    async deposit({ payload, setDapp }: any): Promise<void> {
        const dapp = getAddress(payload);
        setDapp(dapp);
    }
}

export const relay = new Relay();
