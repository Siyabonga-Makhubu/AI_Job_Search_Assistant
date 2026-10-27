/// <reference types="node" />
import "dotenv/config";
import { MongoClient } from "mongodb";

async function checkMongoDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not defined");
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();

    console.log("MongoDB connected successfully");

    const dbName = process.env.MONGODB_DB_NAME || "rag_ingestion_resume";
    const collectionName =
      process.env.MONGODB_COLLECTION_NAME || "rag_ingestion_resume";

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    const count = await collection.countDocuments();

    console.log("Database:", dbName);
    console.log("Collection:", collectionName);
    console.log("Document count:", count);

    if (count === 0) {
      console.log("No documents found. The database is connected, but no resumes have been saved yet.");
      return;
    }

    const documents = await collection
      .find({}, {
        projection: {
          _id: 1,
          name: 1,
          role: 1,
          company: 1,
          skills: 1,
          embeddingModel: 1,
          embeddingDimension: 1,
          embedding: 1
        }
      })
      .limit(5)
      .toArray();

    console.log(`Documents are saved successfully. Showing ${documents.length} of ${count}:`);
    console.dir(documents.map((document) => ({
      _id: document._id,
      name: document.name,
      role: document.role,
      company: document.company,
      skills: document.skills,
      embeddingModel: document.embeddingModel,
      embeddingDimension: document.embeddingDimension,
      embeddingLength: Array.isArray(document.embedding)
        ? document.embedding.length
        : "embedding is missing/not an array"
    })), { depth: null });
  } finally {
    await client.close();
  }
}

checkMongoDB().catch((error) => {
  console.error("MongoDB check failed:");
  console.error(error);
  process.exit(1);
});