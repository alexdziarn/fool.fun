import React, { useState } from 'react';
import { gql } from '@apollo/client';
import { useMutation } from '@apollo/client';
import FileUpload from './FileUpload';
import { useWallet } from '@solana/wallet-adapter-react';
import { 
  Connection, 
  PublicKey, 
  Transaction, 
  SystemProgram,
  TransactionInstruction,
  clusterApiUrl,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { IDL } from '../idl/steal_token';

// TODO: Move this to a config file
export const PROGRAM_ID = new PublicKey("EaDhVtTXRSJrzGNkLGYsA5cQWFPwEYh1vAjF4yh7hUBP");
const DEV_WALLET = new PublicKey("8BcW6T4Sm3tMtE9LJET1oU1vQec6m9R8LifnauQwshCi");

const UPLOAD_FILE = gql`
  mutation UploadFile($file: Upload!) {
    uploadFile(file: $file) {
      url
    }
  }
`;

interface TokenFormData {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string;
  initialPrice: number;
}

async function checkTokenExists(
  connection: Connection,
  tokenPDA: PublicKey
): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenPDA);
    return accountInfo !== null;
  } catch (error) {
    return false;
  }
}

const CreateToken = () => {
  const { publicKey, sendTransaction } = useWallet();
  const [uploadFile] = useMutation(UPLOAD_FILE);
  const [isOpen, setIsOpen] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    initialPrice: 0.1
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({
    name: '',
    ticker: '',
    description: '',
    image: '',
    initialPrice: '',
    general: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleFileSelect = (file: File) => {
    setFileToUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({ name: '', ticker: '', description: '', image: '', initialPrice: '', general: '' });
    
    // Validate fields
    if (formData.name.length > 32) {
      setErrors(prev => ({ ...prev, name: 'Name must be 32 characters or less' }));
      return;
    }

    if (formData.ticker.length > 8) {
      setErrors(prev => ({ ...prev, ticker: 'Symbol must be 8 characters or less' }));
      return;
    }

    if (formData.description.length > 200) {
      setErrors(prev => ({ ...prev, description: 'Description must be 200 characters or less' }));
      return;
    }

    if (!fileToUpload || !publicKey) {
      setErrors(prev => ({ ...prev, image: 'Please connect wallet and select an image' }));
      return;
    }

    if (formData.initialPrice < 0.1 || formData.initialPrice > 1) {
      setErrors(prev => ({ ...prev, initialPrice: 'Initial price must be between 0.1 and 1 SOL' }));
      return;
    }

    setIsLoading(true);
    try {
      // First upload image
      console.log('Uploading file...');
      const { data } = await uploadFile({
        variables: { file: fileToUpload },
        context: {
          headers: {
            'Apollo-Require-Preflight': 'true',
          }
        }
      });

      if (!data?.uploadFile?.url) {
        throw new Error('Failed to upload image');
      }

      console.log('Upload successful:', data.uploadFile.url);

      console.log('Creating token...');

      const connection = new Connection(clusterApiUrl('devnet'));

      // Create instruction data with Borsh-like serialization
      const nameBuffer = Buffer.from(formData.name);
      const symbolBuffer = Buffer.from(formData.ticker);
      const descBuffer = Buffer.from(formData.description);
      const imageBuffer = Buffer.from(data.uploadFile.url);
      const priceBuffer = Buffer.alloc(8);

      // Fix the price conversion
      const lamports = Math.floor(formData.initialPrice * LAMPORTS_PER_SOL);
      priceBuffer.writeBigInt64LE(BigInt(lamports));  // Changed from writeBigUInt64LE

      const [tokenPDA, bump] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          publicKey.toBuffer(),
          Buffer.from(formData.name)
        ],
        PROGRAM_ID
      );

      const exists = await checkTokenExists(connection, tokenPDA);
      if (exists) {
        alert('A token with this name already exists for your wallet. Please choose a different name.');
        return;
      }

      const instructionData = Buffer.concat([
        Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]), // initialize discriminator
        
        // name: string (u32 length + bytes)
        Buffer.from(new Uint32Array([nameBuffer.length]).buffer),
        nameBuffer,
        
        // symbol: string (u32 length + bytes)
        Buffer.from(new Uint32Array([symbolBuffer.length]).buffer),
        symbolBuffer,
        
        // description: string (u32 length + bytes)
        Buffer.from(new Uint32Array([descBuffer.length]).buffer),
        descBuffer,
        
        // image: string (u32 length + bytes)
        Buffer.from(new Uint32Array([imageBuffer.length]).buffer),
        imageBuffer,
        
        // initial_price: u64
        priceBuffer,
        
        // bump: u8
        Buffer.from([bump])
      ]);

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: DEV_WALLET, isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
        ],
        programId: PROGRAM_ID,
        data: instructionData
      });

      try {
        if (!publicKey) throw new Error("Wallet not connected!");

        const latestBlockhash = await connection.getLatestBlockhash('confirmed');
        
        const transaction = new Transaction();
        transaction.add(instruction);
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        console.log('Simulating transaction...');
        const simulation = await connection.simulateTransaction(transaction);
        
        if (simulation.value.err) {
          console.error('Simulation error:', simulation.value.logs);
          throw new Error(`Simulation failed: ${simulation.value.err.toString()}`);
        }

        console.log('Simulation successful:', simulation.value.logs);

        // Simplified transaction sending
        const signature = await sendTransaction(transaction, connection);
        console.log("Transaction sent:", signature);

        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        if (confirmation.value.err) throw new Error('Transaction failed');

        console.log('Token created! Signature:', signature);
        setFormData({ name: '', ticker: '', description: '', imageUrl: '', initialPrice: 0.1 });
        setFileToUpload(null);
        setIsOpen(false);
      } catch (error: any) {
        console.error('Transaction validation failed:', error);
        alert(`Invalid transaction: ${error.message}`);
      }
    } catch (error: any) {
      console.error('Error creating token:', error);
      alert('Failed to create token: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      {!isOpen ? (
        <button
          type="button"
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          onClick={() => setIsOpen(true)}
        >
          Create New Token
        </button>
      ) : (
        <div>
          <div>
            <h2>Create New Token</h2>
            <form onSubmit={handleSubmit}>
              <div>
                <label>
                  Name
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className={`w-full bg-gray-100 border ${errors.name ? 'border-red-500' : 'border-gray-300'} rounded p-2 mt-1 text-black`}
                  />
                </label>
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              
              <div>
                <label>
                  Ticker
                  <input
                    type="text"
                    name="ticker"
                    value={formData.ticker}
                    onChange={handleInputChange}
                    required
                    className={`w-full bg-gray-100 border ${errors.ticker ? 'border-red-500' : 'border-gray-300'} rounded p-2 mt-1 text-black`}
                  />
                </label>
                {errors.ticker && <p className="text-red-500 text-sm mt-1">{errors.ticker}</p>}
              </div>
              
              <div>
                <label>
                  Description
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={4}
                    required
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
              </div>

              <div>
                <label>
                  Initial Price (0.1 - 1 SOL)
                  <input
                    type="number"
                    name="initialPrice"
                    value={formData.initialPrice}
                    onChange={handleInputChange}
                    required
                    min={0.1}
                    max={1}
                    step={0.1}
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
                <small className="text-gray-400">
                  Price must be between 0.1 and 1 SOL
                </small>
              </div>

              <div>
                <label>
                  Token Image
                  <FileUpload onFileSelect={handleFileSelect} />
                </label>
              </div>

              <div>
                <button
                  type="button"
                  className="m-5 rounded-sm bg-white px-2 py-1 text-xs font-semibold text-gray-900 ring-1 shadow-xs ring-gray-300 ring-inset hover:bg-gray-50"
                  onClick={() => setIsOpen(false)}>
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isLoading}
                  className="m-5 rounded-sm bg-indigo-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Creating...
                    </div>
                  ) : (
                    'Create Token'
                  )}
                </button>
              </div>
            </form>
          </div>
          {errors.general && (
            <div className="mt-4">
              <p className="text-red-500 text-sm">{errors.general}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CreateToken;
