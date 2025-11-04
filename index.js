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
        const usersCollection = client.db("Doctor").collection("user");

        // Import Routes
        const appointmentRoutes = require("./routes/appointmentRoutes")(appointmentCollection);
        app.use("/", appointmentRoutes);




        // ✅ একক ইউজার তৈরি + MongoDB তে সেভ
        app.post("/admin/create-user", async (req, res) => {
            const { email, password } = req.body;
            console.log(email, password)
            try {
                // 1️⃣ Firebase-এ ইউজার তৈরি
                const userRecord = await admin.auth().createUser({ email, password });

                // 2️⃣ MongoDB তে ইউজার ইনসার্ট
                const newUser = {
                    uid: userRecord.uid,
                    email: userRecord.email,
                    createdAt: new Date(),
                    role: "user", // চাইলে ডিফল্ট রোল দিতে পারো
                };

                await usersCollection.insertOne(newUser);

                // 3️⃣ রেসপন্স পাঠানো
                res.json({ success: true, user: userRecord });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });


        // ❌ ইউজার ডিলিট (Firebase + MongoDB)
        app.delete("/admin/delete-user/:email", async (req, res) => {
            const { email } = req.params;

            try {
                // 1️⃣ Firebase থেকে ইউজার খুঁজে বের করা
                const user = await admin.auth().getUserByEmail(email);

                // 2️⃣ Firebase থেকে ইউজার ডিলিট করা
                await admin.auth().deleteUser(user.uid);

                // 3️⃣ MongoDB থেকেও ইউজার ডিলিট করা
                const result = await usersCollection.deleteOne({ email });

                if (result.deletedCount === 0) {
                    return res.json({
                        success: true,
                        message: `User deleted from Firebase, but not found in MongoDB.`,
                    });
                }

                // 4️⃣ সব ঠিক থাকলে রেসপন্স পাঠানো
                res.json({ success: true, message: `User ${email} deleted successfully from Firebase and MongoDB.` });

            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        app.patch("/admin/toggle-user/:uid", async (req, res) => {
            try {
                const user = await admin.auth().getUser(req.params.uid);
                const newStatus = !user.disabled;
                await admin.auth().updateUser(req.params.uid, { disabled: newStatus });
                res.json({
                    success: true,
                    message: newStatus
                        ? `User ${user.email} has been deactivated.`
                        : `User ${user.email} has been reactivated.`,
                });
            } catch (error) {
                console.error("Toggle error:", error);
                res.json({ success: false, error: error.message });
            }
        });




        app.get("/admin/create-user", async (req, res) => {
            try {
                const result = await usersCollection.find().toArray();
                res.send(result);
            }
            catch (err) {
                res.status(400).send({ message: "internal server error" })
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
