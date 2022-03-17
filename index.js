const express = require("express");

const admin = require("firebase-admin");
const app = express();
const { MongoClient } = require("mongodb");
const port = process.env.PORT || 5000;
const cors = require("cors");
app.use(cors());
app.use(express.json());
require("dotenv").config();
const objectId = require("mongodb").ObjectId;
console.log(process.env.DB_USER);

// get admin credential from firebase
const serviceAccount = require("./doctor-portal-mui-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ngucd.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// verify admin token
async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith("Bearer ")) {
    const token = req.headers.authorization.split(" ")[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}
async function run() {
  try {
    // connect with mongodb database
    await client.connect();
    const database = client.db("doctors_portal");
    const appointmentsCollection = database.collection("appointments");
    const usersCollection = database.collection("users");
    const serviceCollections = database.collection("services");
    // get specific date all appointments
    app.get("/appointments", async (req, res) => {
      
      const date = new Date(req.query.date).toLocaleDateString();
      const query = { date: date };
      console.log(query)
      const cursor = appointmentsCollection.find(query);
      const appointments = await cursor.toArray();
      console.log(appointments)
      res.json(appointments);
    });
    // create appointments
    app.post("/appointments", async (req, res) => {
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      console.log(result);
      res.json(result);
    });
    // get appointments by id
    app.get("/appointments/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: objectId(id) };
      const result = await appointmentsCollection.findOne(query);
      res.json(result);
    });

  //  get admin user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === "admin") {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
// create user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      console.log(result);
      res.json(result);
    });
    // update user
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });
    // add new admin
    app.put("/users/admin", verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({
          email: requester,
        });
        if (requesterAccount.role === "admin") {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: "admin" } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res
          .status(403)
          .json({ message: "you do not have access to make admin" });
      }
    });
    // add service
    app.post("/addService", async (req, res) => {
      const service = req.body;
      const result = await serviceCollections.insertOne(service);
      console.log(result);
      res.json(result);
    });
  //  get service
    app.get("/addService", async (req, res) => {
      const cursor = serviceCollections.find({});
      const services = await cursor.toArray();
      res.json(services);
    });

      // delete services
      app.delete("/service/:id", async (req, res) => {
        const id = req.params.id;
        const query = { _id: objectId(id) };
        const resultOrder = await serviceCollections.deleteOne(query);
        console.log("deleting user with id", resultOrder);
        res.json(resultOrder);
      });
  
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

console.log(uri);
app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});