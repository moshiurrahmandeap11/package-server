const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const user = process.env.USER_DB;
const pass = process.env.USER_PASS;

const uri = `mongodb+srv://${user}:${pass}@mdb.26vlivz.mongodb.net/?retryWrites=true&w=majority&appName=MDB`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function main() {
  try {
    await client.connect();
    console.log("MongoDB connected");

    const dbs = {
      users: client.db("packageUsersDB").collection("packageUsers"),
      products: client.db("packageProductsDB").collection("packageProducts"),
      banner: client.db("packageBannerDB").collection("packageBanner"),
      cart: client.db("packageAddCartDB").collection("packageAddCart"),
      confirmOrders: client
        .db("packageConfirmOrdersDB")
        .collection("packageConfirmOrders"),
      cancel: client
        .db("packageOrderCancelDB")
        .collection("packageOrderCancel"),
    };

    // Helper async handler to reduce try/catch boilerplate
    const asyncHandler = (fn) => (req, res, next) =>
      Promise.resolve(fn(req, res, next)).catch(next);

    // USERS
    app.get(
      "/users",
      asyncHandler(async (req, res) => {
        const users = await dbs.users.find().toArray();
        res.json(users);
      })
    );

    app.get(
      "/users/:id",
      asyncHandler(async (req, res) => {
        const id = req.params.id;
        const result = await dbs.users.findOne({ _id: new ObjectId(id) });
        res.send(result);
      })
    );

    app.post(
      "/users",
      asyncHandler(async (req, res) => {
        const newUser = req.body;
        const result = await dbs.users.insertOne(newUser);
        res.json(result);
      })
    );

    // DELETE Firebase user
    app.delete(
      "/firebase-users/:uid",
      asyncHandler(async (req, res) => {
        const { uid } = req.params;
        await admin.auth().deleteUser(uid);
        res.json({ message: "Firebase user deleted" });
      })
    );

    // DELETE MongoDB user
    app.delete(
      "/mongo-users/:id",
      asyncHandler(async (req, res) => {
        const { id } = req.params;
        const result = await dbs.users.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 1) {
          res.json({ message: "MongoDB user deleted" });
        } else {
          res.status(404).json({ message: "User not found" });
        }
      })
    );

    // PRODUCTS
    app.get(
      "/products",
      asyncHandler(async (req, res) => {
        const products = await dbs.products.find().toArray();
        res.json(products);
      })
    );

    app.get(
      "/products/:id",
      asyncHandler(async (req, res) => {
        const id = req.params.id;
        const product = await dbs.products.findOne({ _id: new ObjectId(id) });
        res.json(product);
      })
    );

    app.post(
      "/products",
      asyncHandler(async (req, res) => {
        const newProduct = req.body;
        const result = await dbs.products.insertOne(newProduct);
        res.json(result);
      })
    );

    // BANNER
    app.get(
      "/banner",
      asyncHandler(async (req, res) => {
        const banners = await dbs.banner.find().toArray();
        res.json(banners);
      })
    );

    app.post(
      "/banner",
      asyncHandler(async (req, res) => {
        const newBanner = req.body;
        const result = await dbs.banner.insertOne(newBanner);
        res.json(result);
      })
    );

    // CART
    app.get(
      "/add-to-cart",
      asyncHandler(async (req, res) => {
        const carts = await dbs.cart.find().toArray();
        res.json(carts);
      })
    );

    app.get(
      "/add-to-cart/:id",
      asyncHandler(async (req, res) => {
        const id = req.params.id;
        const result = await dbs.cart.findOne({ _id: new ObjectId(id) });
        res.send(result);
      })
    );

    app.post(
      "/add-to-cart",
      asyncHandler(async (req, res) => {
        const newCart = req.body;
        const result = await dbs.cart.insertOne(newCart);
        res.json(result);
      })
    );

    // DELETE: remove item from cart after confirming
    app.delete(
      "/add-to-cart/:id",
      asyncHandler(async (req, res) => {
        const id = req.params.id;
        const result = await dbs.cart.deleteOne({ _id: new ObjectId(id) });

        if (result.deletedCount === 1) {
          res.json({ message: "Order deleted from cart" });
        } else {
          res.status(404).json({ message: "Order not found in cart" });
        }
      })
    );

    // CONFIRM ORDERS
    app.get(
      "/confirm-orders",
      asyncHandler(async (req, res) => {
        const result = await dbs.confirmOrders.find().toArray();
        res.send(result);
      })
    );

    // POST: confirm order
    app.post(
      "/confirm-orders",
      asyncHandler(async (req, res) => {
        const confirmedOrder = req.body;

        if (!confirmedOrder || !confirmedOrder.id) {
          return res.status(400).json({ message: "Invalid order data." });
        }

        // Remove Mongo _id to avoid duplicate key error
        if (confirmedOrder._id) {
          delete confirmedOrder._id;
        }

        // Insert confirmed order into confirmOrders collection
        const result = await dbs.confirmOrders.insertOne(confirmedOrder);

        res
          .status(201)
          .json({ message: "Order confirmed successfully", result });
      })
    );

    // CANCEL ORDERS  
    app.get(
      "/cancel-orders",
      asyncHandler(async (req, res) => {
        const result = await dbs.cancel.find().toArray();
        res.send(result);
      })
    );

    app.post(
      "/cancel-orders",
      asyncHandler(async (req, res) => {
        const cancelOrder = req.body;

        if (!cancelOrder || !cancelOrder.id) {
          return res.status(400).json({ message: "Invalid order data." });
        }

        if (cancelOrder._id) {
          delete cancelOrder._id;
        }

        const result = await dbs.cancel.insertOne(cancelOrder);

        res
          .status(201)
          .json({ message: "Order Cancelled successfully", result });
      })
    );

    app.get("/", (req, res) => {
      res.send("Package is gonna cooking");
    });

    // Global error handler
    app.use((err, req, res, next) => {
      console.error(err);
      res.status(500).json({ error: err.message || "Internal Server Error" });
    });

    app.listen(port, () => {
      console.log(`package server is running on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  }
}

main();
