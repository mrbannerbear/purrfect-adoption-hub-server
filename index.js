import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import dotenv from "dotenv";

const port = process.env.PORT || 4200;

const app = express();

// Middleware
app.use(express.json()); // Parses incoming json requests
app.use(cors()); // Allows server to handle incoming requests
dotenv.config(); // Loads .env file contents into process.env by default

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.v41bc23.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const db = client.db("pet-adoption0");
const allPets = db.collection("all-pets");

app.get("/", (req, res) => {
  res.send("Running Successfully");
});

async function run() {
  try {
    // General apis

    app.get("/all-pets", async (req, res) => {
      let query = {};

      const result = await allPets
        .find(query)
        .sort({ added_date: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const body = { _id: new ObjectId(id) };
      const result = await allPets.findOne(body);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } catch (err) {
    console.log(err);
  }
}

app.listen(port, () => {
  console.log("Successfully running port", port);
});

run().catch(console.dir);
