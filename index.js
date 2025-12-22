const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 5000;

const admin = require("firebase-admin");

const serviceAccount = require("./adminsdk.json");
const { Console, log } = require("console");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



app.use(cors({
    origin: "*",  // Your React frontend
    // origin: ["http://localhost:5173", "http://192.168.68.58:5173"],   // Your React frontend
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
}));
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

        // -------------------------------
        // 🔐 Firebase Token Verification
        // -------------------------------
        const verifyFBToken = async (req, res, next) => {
            const authHeader = req.headers.authorization;
            console.log("Auth Header:", authHeader);

            if (!authHeader) {
                return res.status(401).send({ message: 'Invalid token' });
            }

            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'Invalid token' });
            }

            try {
                const decoded = await admin.auth().verifyIdToken(token, true);

                const now = Math.floor(Date.now() / 1000);
                const sessionTimeout = 3600; // 1 hour

                // token issue time check
                if (now - decoded.iat > sessionTimeout) {
                    return res.status(440).json({ message: "Session expired" });
                }

                req.decoded = decoded;
                next();
            } catch (error) {
                return res.status(401).send({ message: "Invalid token" });
            }
        };


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email });

            if (user?.role !== "AdminUser") {
                return res.status(403).send({ message: "Forbidden access" });
            }
            next();
        };

        const verifyDoctor = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email });

            if (user?.role !== "DoctorUser") {
                return res.status(403).send({ message: "Forbidden access" });
            }
            next();
        };

        const verifyAssistant = async (req, res, next) => {
            const email = req.decoded.email;
            const user = await usersCollection.findOne({ email });

            if (user?.role !== "AssistantUser") {
                return res.status(403).send({ message: "Forbidden access" });
            }
            next();
        };


        const allowRoles = (roles) => {
            return async (req, res, next) => {
                const email = req.decoded.email;
                const user = await usersCollection.findOne({ email });

                if (!user || !roles.includes(user.role)) {
                    return res.status(403).send({ message: "Forbidden access" });
                }

                next();
            };
        };


        const appointmentCollection = client.db("Doctor").collection("appointments");
        const scheduleCollection = client.db("Doctor").collection("schedules");
        const usersCollection = client.db("Doctor").collection("user");
        const drugCollection = client.db("Doctor").collection("drugs");
        const testCollection = client.db("Doctor").collection("tests");
        const noticeCollection = client.db("Doctor").collection("notices");
        const headlineCollection = client.db("Doctor").collection("heddings");
        const CallCollection = client.db("Doctor").collection("calls");
        const messagesCollection = client.db("Doctor").collection("messages");






        // Import Routes
        const appointmentRoutes = require("./routes/appointmentRoutes")(appointmentCollection, verifyFBToken, verifyDoctor, verifyAssistant, allowRoles);
        app.use("/", appointmentRoutes);

        const scheduleRoute = require("./routes/scheduleRoute")(scheduleCollection, usersCollection);
        app.use("/", scheduleRoute);

        const drugRoute = require("./routes/drugRoute")(drugCollection);
        app.use("/", drugRoute);

        const testRoute = require("./routes/testRoute")(testCollection);
        app.use("/", testRoute);

        const noticeRoute = require("./routes/noticeRoute")(noticeCollection, headlineCollection);
        app.use("/", noticeRoute);

        const userRoute = require("./routes/userRoute")(usersCollection);
        app.use("/", userRoute);

        // const call = require("./routes/call")(CallCollection);
        // app.use("/", call);


        // -----------------------------------------
        // 🟢 Socket.io + WebRTC
        // -----------------------------------------
        const server = http.createServer(app);

        const io = new Server(server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
            },
        });

        // let connectedUsers = {};

        io.on("connection", (socket) => {
            console.log("Connected:", socket.id);

            socket.on("user_join_Room", async ({ username, roomId }) => {
                socket.join(roomId);
                console.log(`User ${username} joined room ${roomId}`);


                socket.to(roomId).emit("user_join_Room", {
                    text: `${username} joined the room`,
                });

                const messages = await messagesCollection
                    .find({ roomId })
                    .sort({ timestamp: 1 })
                    .toArray();

                socket.emit("room_messages", messages);
            });

            socket.on("send_message", async (data) => {
                const message = {
                    ...data,
                    timestamp: new Date(),
                };

                await messagesCollection.insertOne(message);

                socket.to(data.roomId).emit("message", message);
            });

            socket.on("user_typing", ({ username, roomId }) => {
                socket.to(roomId).emit("user_typing", { username });
            });

            socket.on("edit_message", async ({ messageId, newText, roomId }) => {
                await messagesCollection.updateOne(
                    { id: messageId },
                    { $set: { text: newText, edited: true } }
                );

                io.to(roomId).emit("message_edited", {
                    messageId,
                    newText,
                });
            });

            socket.on("delete_message", async ({ messageId, roomId }) => {
                await messagesCollection.deleteOne({ id: messageId });
                io.to(roomId).emit("message_deleted", messageId);
            });
        });

        // -----------------------------------------
        // 🟥 Get assistant Users (FIXED)
        // -----------------------------------------
        app.get("/assistant/user/:doctorEmail", async (req, res) => {
            const doctorEmail = req.params.doctorEmail;

            const users = await usersCollection
                .find({ role: "AssistantUser", doctorEmail })
                .toArray();

            res.send(users);
        });






        // -----------------------------------------
        // Default Root
        // -----------------------------------------
        app.get("/", (req, res) => {
            res.send("Doctor Server is Running 🚀");
        });

        // ✅ Correct: server.listen()
        server.listen(port, "0.0.0.0", () => {
            console.log(`Server running on port ${port}`);
        })


    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
    }
}

run();
