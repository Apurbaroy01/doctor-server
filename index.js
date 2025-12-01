const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const http = require("http");
const { Server } = require("socket.io");

const app = express();
const port = process.env.PORT || 5000;

const admin = require("firebase-admin");

const serviceAccount = require("./adminsdk.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});



app.use(cors({
    origin: "http://localhost:5173",   // Your React frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
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
            if (!authHeader) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = authHeader.split(' ')[1];
            if (!token) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }

            try {
                const decoded = await admin.auth().verifyIdToken(token);
                req.decoded = decoded;
                next();
            } catch (error) {
                return res.status(401).send({ message: "Unauthorized access" });
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






        // Import Routes
        const appointmentRoutes = require("./routes/appointmentRoutes")(appointmentCollection, verifyFBToken, verifyDoctor, verifyAssistant, allowRoles);
        app.use("/", appointmentRoutes);

        const scheduleRoute = require("./routes/scheduleRoute")(scheduleCollection);
        app.use("/", scheduleRoute);

        const drugRoute = require("./routes/drugRoute")(drugCollection);
        app.use("/", drugRoute);

        const testRoute = require("./routes/testRoute")(testCollection);
        app.use("/", testRoute);

        const noticeRoute = require("./routes/noticeRoute")(noticeCollection, headlineCollection);
        app.use("/", noticeRoute);

        const userRoute = require("./routes/userRoute")(usersCollection);
        app.use("/", userRoute);

        const call = require("./routes/call")(CallCollection);
        app.use("/", call);


        // -----------------------------------------
        // 🟢 Socket.io + WebRTC
        // -----------------------------------------
        const server = http.createServer(app);

        const io = new Server(server, {
            cors: {
                origin: "http://localhost:5173",
                methods: ["GET", "POST"],
            },
        });

        let connectedUsers = {};

        io.on("connection", (socket) => {
            console.log("🟢 New user connected:", socket.id);

            socket.on("join-room", (roomID) => {
                connectedUsers[socket.id] = roomID;
                socket.join(roomID);
                socket.to(roomID).emit("user-joined", socket.id);
            });

            socket.on("signal", ({ to, data }) => {
                io.to(to).emit("signal", { from: socket.id, data });
            });

            socket.on("disconnect", () => {
                const roomID = connectedUsers[socket.id];
                if (roomID) {
                    socket.to(roomID).emit("user-left", socket.id);
                    delete connectedUsers[socket.id];
                }
                console.log("🔴 User Disconnected:", socket.id);
            });
        });




        // -----------------------------------------
        // Default Root
        // -----------------------------------------
        app.get("/", (req, res) => {
            res.send("Doctor Server is Running 🚀");
        });

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });

    } catch (error) {
        console.error("❌ MongoDB Connection Error:", error.message);
    }
}

run();
