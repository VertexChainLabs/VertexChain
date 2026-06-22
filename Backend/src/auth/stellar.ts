import { Keypair } from '@stellar/stellar-sdk';

export function parseStellarPublicKeyRawBytes(publicKey: string): Buffer {
  const kp = Keypair.fromPublicKey(publicKey);
  return kp.rawPublicKey();
}
