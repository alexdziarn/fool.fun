import React, { useState, useEffect } from 'react';
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
import { PROGRAM_ID, DEV_WALLET } from '../config/constants';
import { useNavigate } from 'react-router-dom';

const UPLOAD_FILE = gql`
  mutation UploadFile($file: Upload!) {
    uploadFile(file: $file) {
      url
    }
  }
`;

interface CreateTokenForm {
  name: string;
  ticker: string;
  description: string;
  imageUrl?: string;
  initialPrice: number;
  priceIncrement: number;
}

const serializeString = (str: string): Buffer => {
  const strBuffer = Buffer.from(str);
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBuffer.length);
  return Buffer.concat([lenBuffer, strBuffer]);
};

async function checkTokenExists(
  connection: Connection,
  tokenPDA: PublicKey
): Promise<boolean> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenPDA);
    return accountInfo !== null;
  } catch (error) {
    console.error('Error checking token existence:', error);
    return false;
  }
}

const serializeU64 = (value: bigint): Buffer => {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
};

interface CreateTokenProps {
  onSuccess?: (tokenId: string) => void;
}

const CreateToken: React.FC<CreateTokenProps> = ({ onSuccess }) => {
  const navigate = useNavigate();
  const { publicKey, sendTransaction } = useWallet();
  const [uploadFile] = useMutation(UPLOAD_FILE);
  const [isOpen, setIsOpen] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [formData, setFormData] = useState<CreateTokenForm>({
    name: '',
    ticker: '',
    description: '',
    imageUrl: '',
    initialPrice: 0.1,
    priceIncrement: 12000,
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

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    
    // Prevent scrolling when modal is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);

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
    if (!publicKey) return;
    setIsLoading(true);
    setErrors({ name: '', ticker: '', description: '', image: '', initialPrice: '', general: '' });
    
    // Validate fields
    if (formData.name.length > 32) {
      setErrors(prev => ({ ...prev, name: 'Name must be 32 characters or less' }));
      setIsLoading(false);
      return;
    }

    if (formData.ticker.length > 8) {
      setErrors(prev => ({ ...prev, ticker: 'Symbol must be 8 characters or less' }));
      setIsLoading(false);
      return;
    }

    if (formData.description.length > 200) {
      setErrors(prev => ({ ...prev, description: 'Description must be 200 characters or less' }));
      setIsLoading(false);
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

      const priceBuffer = Buffer.alloc(8);
      priceBuffer.writeBigUInt64LE(BigInt(Math.floor(formData.initialPrice * LAMPORTS_PER_SOL)));

      // Create price increment buffer correctly
      const priceIncrementBuffer = Buffer.alloc(8);  // Use 8 bytes for u64
      priceIncrementBuffer.writeBigUInt64LE(BigInt(formData.priceIncrement));

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

      const instruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenPDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: new PublicKey(DEV_WALLET), isSigner: false, isWritable: false },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: Buffer.from([
          ...Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]),  // correct initialize discriminator
          ...serializeString(formData.name),
          ...serializeString(formData.ticker),
          ...serializeString(formData.description),
          ...serializeString(data.uploadFile.url || ''),
          ...serializeU64(BigInt(Math.floor(formData.initialPrice * LAMPORTS_PER_SOL))),
          ...serializeU64(BigInt(formData.priceIncrement)),
          ...Buffer.from([bump]),  // Use the actual bump
        ])
      });

      try {
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
        setFormData({
          name: '',
          ticker: '',
          description: '',
          imageUrl: '',
          initialPrice: 0.1,
          priceIncrement: 12000,
        });
        setFileToUpload(null);
        setIsOpen(false);
        handleSuccess(tokenPDA.toString());
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

  const handleSuccess = (tokenId: string) => {
    if (onSuccess) {
      onSuccess(tokenId);
    } else {
      navigate(`/token/${tokenId}`);
    }
    
    setIsOpen(false);
  };

  return (
    <div>
      <button
        type="button"
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        onClick={() => setIsOpen(true)}
      >
        Create New Token
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            {/* Backdrop */}
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => !isLoading && setIsOpen(false)}
            ></div>

            {/* Modal Content */}
            <div className="transform overflow-hidden rounded-lg bg-gray-800 text-left align-middle shadow-xl transition-all w-full max-w-md">
              <div className="px-6 py-5 border-b border-gray-700">
                <h3 className="text-lg font-medium text-white">Create New Token</h3>
              </div>
              
              <div className="px-6 py-4">
                <form onSubmit={handleSubmit}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Name
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className={`w-full p-2 mt-1 bg-gray-700 rounded border ${errors.name ? 'border-red-500' : 'border-gray-600'}`}
                      />
                    </label>
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Ticker
                      <input
                        type="text"
                        name="ticker"
                        value={formData.ticker}
                        onChange={handleInputChange}
                        required
                        className={`w-full p-2 mt-1 bg-gray-700 rounded border ${errors.ticker ? 'border-red-500' : 'border-gray-600'}`}
                      />
                    </label>
                    {errors.ticker && <p className="text-red-500 text-sm mt-1">{errors.ticker}</p>}
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Description
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        rows={4}
                        required
                        className="w-full p-2 mt-1 bg-gray-700 rounded border border-gray-600"
                      />
                    </label>
                    {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
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
                        className="w-full p-2 mt-1 bg-gray-700 rounded border border-gray-600"
                      />
                    </label>
                    <small className="text-gray-400">
                      Price must be between 0.1 and 1 SOL
                    </small>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Price Increment (1.2x - 2.0x)
                      <input
                        type="number"
                        min={1.2}
                        max={2.0}
                        step={0.1}
                        value={formData.priceIncrement / 10000}
                        onChange={(e) => setFormData({
                          ...formData,
                          priceIncrement: Math.floor(Number(e.target.value) * 10000)
                        })}
                        className="w-full p-2 mt-1 bg-gray-700 rounded border border-gray-600"
                        required
                      />
                    </label>
                    <small className="text-gray-400">
                      Each steal will increase the price by this multiplier
                    </small>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">
                      Token Image
                      <FileUpload onFileSelect={handleFileSelect} />
                    </label>
                  </div>

                  {errors.general && (
                    <div className="mb-4 p-3 bg-red-900 bg-opacity-50 rounded">
                      <p className="text-red-300 text-sm">{errors.general}</p>
                    </div>
                  )}

                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
                      onClick={() => !isLoading && setIsOpen(false)}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={isLoading}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 transition-colors disabled:bg-indigo-800 disabled:opacity-70"
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateToken;
