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
        const scheduleCollection = client.db("Doctor").collection("schedules");
        const usersCollection = client.db("Doctor").collection("user");
        const drugCollection = client.db("Doctor").collection("drugs");
        const testCollection = client.db("Doctor").collection("tests");

        // Import Routes
        const appointmentRoutes = require("./routes/appointmentRoutes")(appointmentCollection);
        app.use("/", appointmentRoutes);

        const scheduleRoute = require("./routes/scheduleRoute")(scheduleCollection);
        app.use("/", scheduleRoute)

        const drugRoute = require("./routes/drugRoute")(drugCollection);
        app.use("/", drugRoute);

        const testRoute = require("./routes/testRoute")(testCollection);
        app.use("/", testRoute);



        // custom middleware verify firebase token

        const verifyFBToken = async (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            console.log("Token:", token);

            // verify token---
            try {
                const decoded = await admin.auth().verifyIdToken(token)
                req.decoded = decoded;
                next();
            }
            catch (error) {
                return res.status(401).send({ messagr: "unathorized access" })
            }
        };


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email }
            const user = await usersCollection.findOne(query)
            if (user?.role !== "AdminUser") {
                return res.status(403).send({ message: "forbidden access" })
            }
            next();
        };


        // ✅ Get doctor
        app.get("/alldoctors", async (req, res) => {

            const result = await usersCollection.find().toArray();
            if (!result) {
                return res.status(404).send({ message: "Doctor not found" });
            }

            res.send(result);
        });


        // ✅ Get doctor by email
        app.get("/doctors", async (req, res) => {
            const email = req.query.email;

            const doctor = await usersCollection.findOne({ email: email });

            if (!doctor) {
                return res.status(404).send({ message: "Doctor not found" });
            }

            res.send(doctor);
        });



        // ✅ Admin একক ইউজার তৈরি + MongoDB তে সেভ
        app.post("/admin/create-user", verifyFBToken, async (req, res) => {
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
                    role: "AdminUser", 
                };

                await usersCollection.insertOne(newUser);

              
                res.json({ success: true, user: userRecord });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        // ✅ Doctor একক ইউজার তৈরি + MongoDB তে সেভ
        app.post("/doctor/create-user", verifyFBToken, verifyAdmin, async (req, res) => {
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
                    role: "DoctorUser",
                };

                await usersCollection.insertOne(newUser);

               
                res.json({ success: true, user: userRecord });
            } catch (error) {
                res.status(400).json({ success: false, error: error.message });
            }
        });

        // ✅ ইউজারের রোল চেক করা
        app.get('/users/:email/role', async (req, res) => {
            try {
                const email = req.params.email;
                const user = await usersCollection.findOne({ email });

                if (!user) {
                    return res.status(404).send({ message: 'User not found', role: 'user' });
                }

                res.send({ role: user.role || 'user' });
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: 'Server error' });
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
                const uid = req.params.uid;

                // 1️⃣ Get the current Firebase user
                const user = await admin.auth().getUser(uid);

                // 2️⃣ Directly flip the disabled flag
                const isDisabled = !user.disabled;

                // 3️⃣ Update Firebase user
                await admin.auth().updateUser(uid, { disabled: isDisabled });

                // 4️⃣ Update MongoDB user’s active flag (true = enabled, false = disabled)
                await usersCollection.updateOne(
                    { uid },
                    { $set: { active: !isDisabled } }
                );

                // 5️⃣ Send simple response
                res.json({
                    success: true,
                    message: isDisabled
                        ? `User ${user.email} deactivated successfully.`
                        : `User ${user.email} reactivated successfully.`,
                    firebaseDisabled: isDisabled,
                    mongoActive: !isDisabled,
                });
            } catch (error) {
                console.error("Toggle error:", error);
                res.status(400).json({ success: false, error: error.message });
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
