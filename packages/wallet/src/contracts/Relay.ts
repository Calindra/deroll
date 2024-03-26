import {
    getAddress,
    type Address
} from "viem";
import { MissingContextArgumentError } from "../errors";
import { dAppAddressRelayAddress } from "../rollups";
import { TokenOperation, TokenContext } from "../token";

export class Relay implements TokenOperation {
    isDeposit(msgSender: Address): boolean {
        return msgSender === dAppAddressRelayAddress;
    }
    async deposit({ payload, setDapp }: TokenContext): Promise<void> {
        if (!payload || !setDapp)
            throw new MissingContextArgumentError<TokenContext>({
                setDapp,
                payload,
            });
        const dapp = getAddress(payload);
        setDapp(dapp);
    }
}
