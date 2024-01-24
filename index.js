import express from "express";
import cors from "cors";
import { MongoClient, ObjectId, ServerApiVersion } from "mongodb";
import stripe from "stripe";
import dotenv from "dotenv";
import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";

const stripeInstance = stripe(
  `sk_test_51OExdgCibCkEW5UbRTUs19hjOQxYIP6MSx29lYz3ovUp47qZPuDoUh6hHYyePJDbISBJsOn6rHyAcU5ZisU8T99F00aj1fI4Qi`
);

const port = process.env.PORT || 4200;

const app = express();

// Middleware
app.use(
  express.json({
    limit: "150mb",
  })
); // Parses incoming json requests
app.use(
  cors({
    origin: ["http://localhost:5174", "https://purrfect-client.vercel.app"],
    credentials: true,
  })
); // Allows server to handle incoming requests
dotenv.config(); // Loads .env file contents into process.env by default
app.use(cookieParser());

const tokenVerify = async (req, res, next) => {
  const token = req.cookies?.accessToken;
  console.log(token);
  if (!token) {
    return res.status(401).send({ message: "Not Authorized" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized" });
    }
    req.user = decoded;
    next();
  });
};

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
const adoptionRequests = db.collection("adoption-requests");

// Setting up Cloudinary

cloudinary.config({
  cloud_name: `${process.env.CLOUDINARY_CLOUD}`,
  api_key: `${process.env.CLOUDINARY_API_KEY}`,
  api_secret: `${process.env.CLOUDINARY_SECRET}`,
});

app.get("/", (req, res) => {
  res.send("Running Successfully");
});

async function run() {
  try {
    // jwt api

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "5h",
      });
      res
        .cookie("accessToken", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    app.post("/logout", async (req, res) => {
      const body = req.body;
      res
        .clearCookie("accessToken", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production" ? true : false,
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ loggedOut: true });
    });

    // Cloudinary api

    app.post("/cloudinary", (req, res) => {
      cloudinary.uploader
        .upload(req.body.image, {
          public_id: `${req.body.imageName}`,
          upload_preset: "tx2drc96",
        })
        .then((result) => {
          // console.log(result);
          res.send({
            status: "200 OK",
            public_id: result.public_id,
            imgURL: result.url,
          });
        })
        .catch((err) => {
          // console.error(err);
          res.status(500).send({
            status: "Internal Server Error",
          });
        });
    });

    // General apis

    app.get("/all-pets", async (req, res) => {
      let query = {};

      const result = await allPets
        .find(query)
        .sort({ added_dateShort: -1 })
        .toArray();
      res.send(result);
    });

    app.get("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const body = { _id: new ObjectId(id) };
      const result = await allPets.findOne(body);
      res.send(result);
    });

    app.post("/all-pets", tokenVerify, async (req, res) => {
      const body = req.body;
      const result = await allPets.insertOne(body);
      res.send(result);
    });

    app.patch("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = { _id: new ObjectId(id) };
      const existingPet = await allPets.findOne(filter);
      console.log(body);

      const updatedPet = {
        $set: {
          name: body?.name || existingPet.name,
          category: body?.category || existingPet.category,
          age: body?.age || existingPet.age,
          location: body?.location || existingPet.location,
          shortDescription:
            body?.shortDescription || existingPet.shortDescription,
          longDescription: body?.longDescription || existingPet.longDescription,
          image: body?.image || existingPet.image,
          imageName: body?.imageName || existingPet.imageName,
          adopted:
            body.adopted !== undefined || body.adopted !== null
              ? body.adopted
              : existingPet.adopted,
          added_dateShort: body?.added_dateShort || existingPet.added_dateShort,
          added_date: body?.added_date || existingPet.added_date,
          userName: body?.userName || existingPet.userName,
          userEmail: body?.userEmail || existingPet.userEmail,
        },
      };
      const result = await allPets.updateOne(filter, updatedPet);
      res.send(result);
    });

    app.delete("/all-pets/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allPets.deleteOne(query);
      res.send(result);
    });

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

    app.get("/users/:id", async (req, res) => {
      const id = req.params.id;
      const body = { _id: new ObjectId(id) };
      const result = await users.findOne(body);
      res.send(result);
    });

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

    app.get("/adoption-requests", async (req, res) => {
      const result = await adoptionRequests.find().toArray();
      res.send(result);
    });

    app.post("/adoption-requests", async (req, res) => {
      const body = req.body;
      console.log(body);
      const result = await adoptionRequests.insertOne(body);
      res.send(result);
    });

    app.get("/adoption-requests/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await adoptionRequests.findOne(filter);
      res.send(result);
    });

    app.delete("/adoption-requests/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await adoptionRequests.deleteOne(query);
      res.send(result);
    });

    app.get("/donations", async (req, res) => {
      const result = await donations.find().sort({ addedDate: -1 }).toArray();
      res.send(result);
    });

    app.post("/donations", tokenVerify, async (req, res) => {
      const body = req.body;
      const result = await donations.insertOne(body);
      res.send(result);
    });

    app.get("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const body = { _id: new ObjectId(id) };
      const result = await donations.findOne(body);
      res.send(result);
    });

    app.post("/donations/:id", tokenVerify, async (req, res) => {
      const id = req.params.id;
      const newDonation = req.body?.userDonations;

      const result = await donations.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $push: { userDonations: newDonation } },
        { returnDocument: "after" }
      );

      res.send(result);
    });

    app.delete("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const donorEmail = req.query?.donorEmail;
      const donationDate = req.query?.donationDate;
    //   const donationAmount = req.query?.donationAmount;

      console.log(donorEmail)
      
      const result = await donations.updateOne(
        { 
          _id: new ObjectId(id),
        },
        {
          $pull: {
           "userDonations": {
              donorEmail: donorEmail,
              donationDate: donationDate,
            //   donationAmount: donationAmount,
            },
          },
        }
      )
      res.send(result)
    }
    );

    app.patch("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const body = req.body;

      const filter = { _id: new ObjectId(id) };
      const existingDonation = await donations.findOne(filter);
      console.log(req.body);
      const updatedAmount = {
        $set: {
          category: body.category || existingDonation.category,
          name: body.name || existingDonation.name,
          shortDescription:
            body.shortDescription || existingDonation.shortDescription,
          longDescription:
            body.longDescription || existingDonation.longDescription,
          image: body.image || existingDonation.image,
          maxDonation: body.maxDonation || existingDonation.maxDonation,
          donated: body.donated || existingDonation.donated,
          lastDate: body.lastDate || existingDonation.lastDate,
          //   addedDate: body.addedDate || existingDonation.addedDate,
          userDonations: body.userDonations || existingDonation.userDonations,
          donationPaused:
            body.donationPaused !== undefined || body.donationPaused !== null
              ? body.donationPaused
              : existingDonation.donationPaused,
        },
      };
      const result = await donations.updateOne(filter, updatedAmount);
      res.send(result);
    });

    app.delete("/donations/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await donations.deleteOne(query);
      res.send(result);
    });

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
