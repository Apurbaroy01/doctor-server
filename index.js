const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 5000;

const admin = require("firebase-admin");

const serviceAccount = require("./adminsdk.json");
const { Console } = require("console");

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

        io.on('connection', (socket) => {
            console.log('a user connected:', socket.id, "is connected");

            // handle join room
            socket.on("user_join_Room", async (data) => {
                const { username, roomId } = data || {};
                console.log("Join Room Data:", data);

                socket.join(roomId);

                // notify others in room
                socket.to(roomId).emit("user_join_Room", {
                    text: `${username} has joined the chat room.`,
                });

                // 1️⃣ Fetch previous messages from MongoDB and send to this user
                try {
                    const messages = await messagesCollection
                        .find({ roomId })
                        .sort({ timestamp: 1 })
                        .toArray();

                    // Send previous messages ONLY to the joining user
                    socket.emit("room_messages", messages);
                } catch (error) {
                    console.error("Error fetching messages from MongoDB:", error);
                }


                console.log(`user with id: ${username} joined room: ${roomId}`);

                // broadcast the message  to everyone in the room
                socket.on("send_message", async ({ username, roomId, text }) => {

                    try {
                        // Save message to MongoDB
                        const messageDocument = {
                            username,
                            roomId,
                            text,
                            type: "regular",
                            timestamp: new Date(),
                        };
                        const result = await messagesCollection.insertOne(messageDocument);

                        // 2️⃣ Emit message to everyone in the room (including sender)
                        socket.to(roomId).emit("message", {
                            // _id: result.insertedId,
                            ...messageDocument,
                        });

                    } catch (error) {
                        console.error("Error saving message to MongoDB:", error);
                    }

                    // socket.to(roomId).emit("message", { username, text, type: "regular" });
                })

                // handle user disconnect
                socket.on("user_left_Room", ({ username, roomId }) => {
                    socket.to(roomId).emit("message", {
                        username,
                        text: `${username} has left the chat room.`, type: 'notif',
                    });

                })

                // Detecting typing activity
                socket.on("user_typing", ({ username, roomId }) => {
                    // send to everyone in room EXCEPT sender
                    socket.to(roomId).emit("user_typing", { username });
                });

            })
        })




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
