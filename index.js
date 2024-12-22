const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require('dotenv').config();
const cors = require("cors");
const app = express();
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5cknjnc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

app.use(cors({
  origin: [
    'http://localhost:5173',
    // 'http://localhost:5174',
    // 'https://online-gift-shop-a4212.web.app',
    // 'https://online-gift-shop.netlify.app'
  ],
  credentials: true
}));

app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const productCollection = client.db("online-camera-shop").collection("product");
    const cartCollection = client.db("online-camera-shop").collection("cart");
    const userCollection = client.db("online-camera-shop").collection("users");
    const locationCollection = client.db("online-camera-shop").collection("location");
    const orderCollection = client.db("online-camera-shop").collection("manageorder");

    //------------------ JWT Related API ------------------

    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });

    //------------------ Middlewares Related API ------------------

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'Unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isSeller = user?.role === 'seller';
      if (!isSeller) {
        return res.status(403).send({ message: 'Forbidden access' });
      }
      next();
    };

    //------------------ User Related API ------------------

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: 'User already exists', insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    //------------------ Admin Related API ------------------

    app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.get('/users/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin';
      }
      res.send({ admin });
    });

    app.delete('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.deleteOne(query);
      res.send(result);
    });

    app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'admin'
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    //------------------ Seller Related API ------------------

    app.get('/users/seller/:email', verifyToken, async (req, res) => {
      const email = req.params.email;

      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden access' });
      }

      const query = { email: email };
      const user = await userCollection.findOne(query);
      let seller = false;
      if (user) {
        seller = user?.role === 'seller';
      }
      res.send({ seller });
    });

    app.patch("/users/seller/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: 'seller'
        },
      };
      const result = await userCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });


    //------------------ Product Related API ------------------

    app.post('/product', async (req, res) => {
      const newProduct = req.body;
      newProduct.creator = req.query.email; // Set the creator field based on the authenticated user
      const result = await productCollection.insertOne(newProduct);
      res.send(result);
    });

    app.get("/product", async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });

    app.get('/product/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    app.put("/product/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedProduct = {
        $set: {
          name: data.name,
          brand: data.brand,
          description: data.description,
          price: data.price,
          category: data.category,
          photos: data.photos
        },
      };
      const result = await productCollection.updateOne(filter, updatedProduct);
      res.send(result);
    });

    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    //------------------ Cart Related API ------------------

    app.post('/cart', async (req, res) => {
      const cartProduct = req.body;
      const result = await cartCollection.insertOne(cartProduct);
      res.send(result);
    });

    app.get('/cart', async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    //------------------ Location Related API ------------------

    app.post('/location', async (req, res) => {
      const newLocation = req.body;
      const email = newLocation.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      const query = { email: email };
      const existingLocation = await locationCollection.findOne(query);

      if (existingLocation) {
        // Update the existing location
        const result = await locationCollection.updateOne(query, { $set: newLocation });
        res.send(result);
      } else {
        // Insert a new location
        const result = await locationCollection.insertOne(newLocation);
        res.send(result);
      }
    });

    app.get('/location', async (req, res) => {
      const email = req.query.email;

      if (!email) {
        return res.status(400).send({ error: "Email is required" });
      }

      const query = { email: email };
      const result = await locationCollection.find(query).toArray();
      res.send(result);
    });

    app.get('/location/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await locationCollection.findOne(query);
      res.send(result);
    });

    app.put("/location/:id", async (req, res) => {
      const id = req.params.id;
      const data = req.body;
      const filter = { _id: new ObjectId(id) };
      const updatedLocation = {
        $set: {
          name: data.name,
          phone: data.phone,
          city: data.city,
          area: data.area,
          address: data.address,
        },
      };
      const result = await locationCollection.updateOne(filter, updatedLocation);
      res.send(result);
    });

    app.delete('/location/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await locationCollection.deleteOne(query);
      res.send(result);
    });

    //------------------ Manage Order Related API ------------------

    app.post('/manageorder', async (req, res) => {
      const orderProduct = req.body;
      const result = await orderCollection.insertOne(orderProduct);
      res.send(result);
    });

    app.get('/manageorder', async (req, res) => {
      const result = await orderCollection.find().toArray();
      res.send(result);
    });

    app.get("/", (req, res) => {
      res.send("Crud is running...");
    });

    app.listen(port, () => {
      console.log(`Simple Crud is Running on port ${port}`);
    });

  } finally {
    // await client.close();
  }
}

run().catch(console.dir);
