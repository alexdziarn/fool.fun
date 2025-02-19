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
  clusterApiUrl
} from '@solana/web3.js';
import { IDL } from '../idl/steal_token';

const PROGRAM_ID = new PublicKey("FesSNkUMZv5faqXuwXGqmDedin46bXkzmfPzNYx17T8k");
const DEV_WALLET = new PublicKey("9P9GUVz1EMfe3KF6NKgM7kMGkuETKGLei7yHmoETD9gN");

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
    
    if (!fileToUpload || !publicKey) {
      alert('Please connect wallet and select an image');
      return;
    }

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

      // Create instruction data
      const nameBuffer = Buffer.from(formData.name);
      const symbolBuffer = Buffer.from(formData.ticker);
      const descBuffer = Buffer.from(formData.description);
      const imageBuffer = Buffer.from(data.uploadFile.url);
      const priceBuffer = Buffer.alloc(8);
      priceBuffer.writeBigUInt64LE(BigInt(formData.initialPrice * 1_000_000_000));

      const instructionData = Buffer.concat([
        Buffer.from([0]), // instruction index for 'initialize'
        Buffer.from([nameBuffer.length]),
        nameBuffer,
        Buffer.from([symbolBuffer.length]),
        symbolBuffer,
        Buffer.from([descBuffer.length]),
        descBuffer,
        Buffer.from([imageBuffer.length]),
        imageBuffer,
        priceBuffer
      ]);

      // Calculate PDA
      const [tokenPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('token'),
          publicKey.toBuffer(),
          Buffer.from(formData.name)
        ],
        PROGRAM_ID
      );

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

      const transaction = new Transaction().add(instruction);
      const signature = await sendTransaction(transaction, connection);
      
      await connection.confirmTransaction({
        signature,
        blockhash: transaction.recentBlockhash,
        lastValidBlockHeight: transaction.lastValidBlockHeight
      });
      console.log('Token created! Signature:', signature);

      // Reset form
      setFormData({
        name: '',
        ticker: '',
        description: '',
        imageUrl: '',
        initialPrice: 0.1
      });
      setFileToUpload(null);
      setIsOpen(false);

    } catch (error) {
      console.error('Error creating token:', error);
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
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
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
                    className="w-full bg-gray-100 border border-gray-300 rounded p-2 mt-1 text-black"
                  />
                </label>
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
                  className="m-5 rounded-sm bg-indigo-600 px-2 py-1 text-xs font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Create Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateToken;
