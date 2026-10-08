import 'dotenv/config';
import { MongoClient } from 'mongodb';

async function testMongoConnection() {
  console.log('🍃 Testing MongoDB Atlas Cluster Connection...\n');
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.log('❌ MONGODB_URI is not set in .env');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Successfully Connected to MongoDB Atlas Cluster!');

    const db = client.db('nexusrail');
    const collections = await db.listCollections().toArray();
    console.log(`   Database Name: "nexusrail"`);
    console.log(`   Existing Collections Count: ${collections.length}`);

    // Insert test audit trace document into 'agent_audit_traces' collection
    const result = await db.collection('agent_audit_traces').insertOne({
      test: true,
      service: 'NexusRail AI Telemetry Logger',
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ Telemetry Audit Trace Document Inserted! (ID: ${result.insertedId})`);
  } catch (error: any) {
    console.log(`⚠️ MongoDB Atlas Connection Error: ${error.message}`);
  } finally {
    await client.close();
  }
}

testMongoConnection().catch(console.error);
