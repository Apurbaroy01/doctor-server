const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// MongoDB Connection
const uri = "mongodb+srv://doctor12:doctor12@cluster0.4gy1j38.mongodb.net/?appName=Cluster0";
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
    try {
        await client.connect();
        console.log("✅ MongoDB Connected Successfully");

        const appointmentCollection = client.db("Doctor").collection("appointments");

        // Import Routes
        const appointmentRoutes = require("./routes/appointmentRoutes")(appointmentCollection);
        app.use("/", appointmentRoutes);

        app.get("/", (req, res) => {
            res.send("Doctor Server is Running 🚀");
        });

        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
    }
}

run();
