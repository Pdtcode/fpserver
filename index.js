const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

app.use(cors(corsConfig));
app.options("", cors(corsConfig));
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q3tpezp.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Define an array of collection names or slugs you want to fetch and update
const collectionsToFetch = [
  "cryptohipposnft",
  "gamingapeclub",
  "everfyre-genesis",
  "meowniverse-meowtizen",
  "official-skyverse",
  "gridcraft-genesis-identities",
  "gridcraft-network-golden-tickets",
  "nucyber",
  "pixelmongen1",
  "pixelmon-ev-2-serum",
  "pixels-farm",
  "unordinals",
  "on-the-edge-of-oblivion",
  "distortion-ordinal-claim-pass",
  "trainersgen1",
  "digital-doka-gen-1",
  "imaginary-rides"
  
  // Add more collection slugs as needed
];

const apiKey = process.env.API_KEY;
const requestsPerSecond = 2;
const interval = 1000 / requestsPerSecond; // Convert requests per second to milliseconds

let tokens = requestsPerSecond; // Initialize tokens
const tokenBucket = setInterval(() => {
  tokens = Math.min(tokens + 1, requestsPerSecond);
}, interval);

async function fetchDataAndUpdateCollections() {
  try {
    for (const collectionSlug of collectionsToFetch) {
      while (tokens <= 0) {
        console.log("Rate limit reached. Waiting for tokens...");
        await new Promise((resolve) => setTimeout(resolve, interval)); // Wait for more tokens
      }

      tokens--; // Deduct a token

      // Construct the API URL for the collection
      const apiUrl = `https://api.opensea.io/api/v1/collection/${collectionSlug}`;

      // Fetch data from the OpenSea API with API key included in the headers
      const axiosConfig = { method: 'GET', headers: { 'X-API-KEY': apiKey } };

      // Fetch data from the OpenSea API
      const response = await axios.get(apiUrl, axiosConfig);

      // Extract the floor price from the fetched data
      const floorPrice = parseFloat(response.data.collection.stats.floor_price);

      // Update the database with the fetched floor price
      const nftCollection = client.db("v1").collection("nft");

      // Use the slug as the filter to identify the specific document to update
      const filter = { slug: collectionSlug };
      const updateDoc = {
        $set: { floorprice: floorPrice },
      };

      // Update the document in the collection
      await nftCollection.updateOne(filter, updateDoc);

      console.log(`Floor price for collection ${collectionSlug} updated in the database.`);
    }
  } catch (error) {
    console.error("Error fetching or updating data:", error);
  }
}


// Schedule the fetchDataAndUpdateCollections function to run periodically
const updateInterval = 3600000; // 1 hour

setInterval(fetchDataAndUpdateCollections, updateInterval);

async function run() {
  try {
    await client.connect();

    const nftCollection = client.db("v1").collection("nft");

    // Define your routes here
    app.get("/api", async (req, res) => {
      const result = await nftCollection.find().toArray();
      res.send(result);
    });

    app.delete("/deleteNFT/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await nftCollection.deleteOne(query);
      res.send(result);
    });

    app.post("/add", async (req, res) => {
      try {
        // Get the data for the new collection from the request body
        const { slug, floorprice, count } = req.body;
    
        // Insert the new collection into the MongoDB database
        const nftCollection = client.db("v1").collection("nft");
        const result = await nftCollection.insertOne({
          slug,
          floorprice,
          count,
        });
    
        res.status(201).json({ message: "Collection added successfully", data: result.ops[0] });
      } catch (error) {
        console.error("Error adding collection:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    

    // Define other routes as needed

    // Start the server
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server is running on port: ${port}`);
    });
  } finally {
    // Ensure that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);
