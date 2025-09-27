import { MongoClient, type MongoClientOptions } from 'mongodb';

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI || "";

const options: MongoClientOptions = {
  // Fail fast instead of waiting ~30s+ on bad DNS/TLS/IP allowlist issues
  serverSelectionTimeoutMS: 10000,
  connectTimeoutMS: 10000,
  retryWrites: true,
};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient>;

if (!uri) {
  // Avoid throwing at import time to prevent build failures.
  // Consumers will get a clear error when attempting to use the client.
  clientPromise = Promise.reject(new Error('Please add your Mongo URI to .env.local'));
} else if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the client
  // is not recreated on every hot reload
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect().catch((err: unknown) => {
      console.error("[MongoDB] Connection error (dev):", err);
      throw err;
    });
  }
  clientPromise = global._mongoClientPromise!;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect().catch((err: unknown) => {
    console.error("[MongoDB] Connection error (prod):", err);
    throw err;
  });
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;
