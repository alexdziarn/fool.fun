import { ApolloServer, gql } from 'apollo-server-express';
import express from 'express';
import { GraphQLUpload, graphqlUploadExpress } from 'graphql-upload';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import * as fs from 'fs';
import * as path from 'path';

const bucket = getStorage().bucket();

export const ImageUpload = {
  Mutation: {
    uploadImage: async (_: any, { file }: { file: any }) => {
      const { createReadStream, filename } = await file;

      // Create a temporary file path
      const filePath = path.join(__dirname, 'temp', filename);
      const stream = createReadStream();

      // Save the file temporarily
      await new Promise((resolve, reject) =>
        stream
          .pipe(fs.createWriteStream(filePath))
          .on('finish', resolve)
          .on('error', reject)
      );

      // Upload to Firebase Storage
      const bucketFile = bucket.file(`images/${filename}`);
      await bucketFile.save(fs.readFileSync(filePath), {
        contentType: 'image/jpeg', // Adjust based on file type
      });

      // Get the public URL
      const [url] = await bucketFile.getSignedUrl({
        action: 'read',
        expires: '03-09-2025', // Set an expiration date
      });

      // Delete the temporary file
      fs.unlinkSync(filePath);

      return { url };
    },
  },
}