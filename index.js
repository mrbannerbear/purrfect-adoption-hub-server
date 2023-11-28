import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import stripe from "stripe";
import dotenv from "dotenv";

const stripeInstance = stripe(
  `sk_test_51OExdgCibCkEW5UbRTUs19hjOQxYIP6MSx29lYz3ovUp47qZPuDoUh6hHYyePJDbISBJsOn6rHyAcU5ZisU8T99F00aj1fI4Qi`
);

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
const users = db.collection("users");
const donations = db.collection("donations");

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

    app.patch("/all-pets/:id", async(req, res) => {
        const id = req.params.id
        const body = req.body
        const filter = { _id: new ObjectId(id) }
        const existingPet = await allPets.findOne(filter)
        console.log(existingPet?.adopted)

        const updatedPet = {
            $set: {
                name: body.name || existingPet.name,
                category: body.category || existingPet.category,
                adopted: body.adopted !== undefined || body.adopted !== null ? body.adopted : existingPet.adopted
            }
        }

        console.log(updatedPet)
        const result = await allPets.updateOne(filter, updatedPet)
        res.send(result)
    })

    app.delete("/all-pets/:id", async(req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await allPets.deleteOne(query)
        res.send(result)
    })

    app.get("/users", async (req, res) => {
      let query = {};
      const email = req.query.email;
      const existingUser = await users.findOne({ email: email });
      if (existingUser) {
        query = {
          email: email,
        };
      }
      const result = await users.find(query).toArray();
      res.send(result);
    });

    app.get("/users/:id", async(req, res) => {
        const id = req.params.id;
        const body = { _id: new ObjectId(id) };
        const result = await users.findOne(body);
        res.send(result);
    })

    app.post("/users", async (req, res) => {
      const body = req.body;
      const query = { email: body.email };
      const existingUser = await users.findOne(query);
      if (existingUser) {
        return res.send({ message: "User registered already" });
      }
      const result = await users.insertOne(body);
      res.send(result);
    });

    app.patch("/users/:id", async (req, res) => {
        const id = req.params.id;
        const { role } = req.body;
        const filter = { _id: new ObjectId(id) };

        const updatedUser = {
            $set: {
                role: role,
            },
        };

        const result = await users.updateOne(filter, updatedUser);
        res.send(result);
    });

    app.get("/donations", async (req, res) => {
      const result = await donations.find().sort({ addedDate: 1 }).toArray();
      res.send(result);
    });

    app.get("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const body = { _id: new ObjectId(id) };
      const result = await donations.findOne(body);
      res.send(result);
    });

    app.post("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const newDonation = req.body?.userDonations;

      const result = await donations.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $push: { userDonations: newDonation } },
        { returnDocument: "after" }
      );

      res.send(result)

    });

    app.patch("/donations/:id", async(req, res) => {
        const id = req.params.id
        const body = req.body

        const filter = { _id: new ObjectId(id) }
        const existingDonation = await donations.findOne(filter);

        const updatedAmount = {
            $set: {
                category: body.category || existingDonation.category,
                name: body.name || existingDonation.name,
                shortDescription: body.shortDescription || existingDonation.shortDescription,
                longDescription: body.longDescription || existingDonation.longDescription,
                image: body.image || existingDonation.image,
                maxDonation: body.maxDonation || existingDonation.maxDonation,
                donated: body.donated || existingDonation.donated,
                lastDate: body.lastDate || existingDonation.lastDate,
                addedDate: body.addedDate || existingDonation.addedDate,
                userDonations: body.userDonations || existingDonation.userDonations,
                donationPaused: body.donationPaused !== undefined || body.donationPaused !== null ? body.donationPaused : existingDonation.donationPaused
            },
        };
        const result = await donations.updateOne(filter, updatedAmount)
        res.send(result)
    })


    app.delete("/donations/:id", async(req, res) => {
        const id = req.params.id
        const query = { _id: new ObjectId(id) }
        const result = await donations.deleteOne(query)
        res.send(result)
    })

    // Payment intent

    app.post("/payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        client_secret: paymentIntent.client_secret,
      });
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
