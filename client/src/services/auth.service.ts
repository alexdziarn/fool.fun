import { gql } from '@apollo/client';
import { client } from '../apollo-client';
import * as bs58 from 'bs58';

const VERIFY_SIGNATURE = gql`
  mutation VerifySignature($publicKey: String!, $signature: String!, $message: String!) {
    verifySignature(publicKey: $publicKey, signature: $signature, message: $message) {
      success
    }
  }
`;

export const signMessage = async (
  publicKey: string, 
  signature: Uint8Array, 
  message: string
): Promise<boolean> => {
  try {
    const { data } = await client.mutate({
      mutation: VERIFY_SIGNATURE,
      variables: {
        publicKey,
        signature: bs58.encode(signature),
        message
      }
    });
    
    return data.verifySignature.success;
  } catch (error) {
    console.error('Signature verification failed:', error);
    return false;
  }
};