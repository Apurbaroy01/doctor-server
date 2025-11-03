const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");
const serviceAccount = require("./adminsdk.json");

const app = express();
const port = process.env.PORT || 5000;

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

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




        // ✅ একক ইউজার তৈরি
        app.post("/admin/create-user", async (req, res) => {
            const { email, password } = req.body;
            try {
                const userRecord = await admin.auth().createUser({ email, password });
                res.json({ success: true, user: userRecord });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        // ❌ ইউজার ডিলিট
        app.delete("/admin/delete-user/:email", async (req, res) => {
            const { email } = req.params;
            try {
                const user = await admin.auth().getUserByEmail(email);
                await admin.auth().deleteUser(user.uid);
                res.json({ success: true, message: `User ${email} deleted successfully` });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });


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
