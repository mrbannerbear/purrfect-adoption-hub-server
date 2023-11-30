import mongoose from "mongoose";

mongoose.connect("mongodb://localhost:4200/all-pets")
.then(() => console.log("Mongoose connected"))
.catch(err => console.log(err))