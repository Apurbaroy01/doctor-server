const express = require("express");


module.exports = function (usersCollection) {
    const app = express.Router();
    const admin = require("firebase-admin");
    

    // -----------------------------------------
    // 🟦 Doctor List API (By Role)
    // -----------------------------------------
    app.get("/alldoctors", async (req, res) => {
        const result = await usersCollection.find({ role: "DoctorUser" }).toArray();
        res.send(result);
    });

    // -----------------------------------------
    // 🟦 Get doctor by email
    // -----------------------------------------
    app.get("/doctors", async (req, res) => {
        const email = req.query.email;
        const doctor = await usersCollection.findOne({ email });

        if (!doctor) {
            return res.status(404).send({ message: "Doctor not found" });
        }

        res.send(doctor);
    });

    // -----------------------------------------
    // 👑 Admin User Creation
    // -----------------------------------------
    app.post("/admin/create-user", async (req, res) => {
        const { email, password } = req.body;

        try {
            const userRecord = await admin.auth().createUser({ email, password });

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

    // -----------------------------------------
    // 👨‍⚕️ Doctor User Creation (Default active + expiryDate)
    // -----------------------------------------
    app.post("/doctor/create-user", async (req, res) => {
        const { email, password } = req.body;

        try {
            const userRecord = await admin.auth().createUser({ email, password });

            const newUser = {
                uid: userRecord.uid,
                email: userRecord.email,
                createdAt: new Date(),
                role: "DoctorUser",
                active: true,
                expiryDate: null, // ⬅️ Custom expiry default
            };

            await usersCollection.insertOne(newUser);

            res.json({ success: true, user: newUser });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    // -----------------------------------------
    // 👨‍⚕️ Doctor Assistant Creation (Default active )
    // -----------------------------------------
    app.post("/assistant/create-user", async (req, res) => {
        const { email, password, doctorId, doctorEmail } = req.body;

        try {
            // 1️⃣ Create Firebase Auth user
            const userRecord = await admin.auth().createUser({ email, password });

            // 2️⃣ Set Custom Claims (role, doctorId, doctorEmail)
            await admin.auth().setCustomUserClaims(userRecord.uid, {
                role: "AssistantUser",
                doctorId: doctorId,
                doctorEmail: doctorEmail,
            });

            // 3️⃣ Save to MongoDB
            const newUser = {
                doctorId,
                doctorEmail,
                uid: userRecord.uid,
                email: userRecord.email,
                createdAt: new Date(),
                role: "AssistantUser",
                active: true,
            };

            await usersCollection.insertOne(newUser);

            res.json({ success: true, user: newUser });
        } catch (error) {
            console.error("❌ Assistant create error:", error);
            res.status(400).json({ success: false, error: error.message });
        }
    });


    // -----------------------------------------
    // 🟪 Get User Role
    // -----------------------------------------
    app.get('/users/:email/role', async (req, res) => {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });

        if (!user) {
            return res.status(404).send({ message: 'User not found', role: 'user' });
        }

        res.send({ role: user.role || 'user' });
    });

    // -----------------------------------------
    // ❌ Delete User (Firebase + MongoDB)
    // -----------------------------------------
    app.delete("/admin/delete-user/:email", async (req, res) => {
        const { email } = req.params;

        try {
            const user = await admin.auth().getUserByEmail(email);

            await admin.auth().deleteUser(user.uid);
            const result = await usersCollection.deleteOne({ email });

            res.json({ success: true, message: `User ${email} deleted successfully.` });

        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    // -----------------------------------------
    // 🔄 Toggle User Active/Disabled
    // -----------------------------------------
    app.patch("/admin/toggle-user/:uid", async (req, res) => {
        try {
            const uid = req.params.uid;

            const user = await admin.auth().getUser(uid);
            const isDisabled = !user.disabled;

            await admin.auth().updateUser(uid, { disabled: isDisabled });

            await usersCollection.updateOne(
                { uid },
                { $set: { active: !isDisabled } }
            );

            res.json({
                success: true,
                message: isDisabled
                    ? `User ${user.email} deactivated.`
                    : `User ${user.email} activated.`,
            });
        } catch (error) {
            res.status(400).json({ success: false, error: error.message });
        }
    });

    // -----------------------------------------
    // 🟩 SET CUSTOM EXPIRY DATE API
    // -----------------------------------------
    app.patch("/admin/set-expiry/:uid", async (req, res) => {
        const { uid } = req.params;
        const { customDate } = req.body;

        try {
            await usersCollection.updateOne(
                { uid },
                { $set: { expiryDate: new Date(customDate) } }
            );

            res.json({ success: true, message: "Expiry date updated." });

        } catch (error) {
            res.json({ success: false, error: error.message });
        }
    });

    // -----------------------------------------
    // 🟧 Get Doctor Users + Auto Disable Expired Users
    // -----------------------------------------
    app.get("/doctor/create-user", async (req, res) => {
        try {
            const users = await usersCollection.find({ role: "DoctorUser" }).toArray();
            const now = new Date();

            for (let user of users) {
                if (user.expiryDate && now > new Date(user.expiryDate)) {
                    // Disable in Firebase
                    // await admin.auth().updateUser(user.uid, { disabled: true });

                    // Disable in MongoDB
                    await usersCollection.updateOne(
                        { uid: user.uid },
                        { $set: { active: false } }
                    );

                    user.active = false;
                }

                else if (user.expiryDate && now <= new Date(user.expiryDate)) {
                    // Enable in Firebase
                    // await admin.auth().updateUser(user.uid, { disabled: false });
                    // Enable in MongoDB
                    await usersCollection.updateOne(
                        { uid: user.uid },
                        { $set: { active: true } }
                    );
                    user.active = true;
                }
            }

            const updatedUsers = await usersCollection.find({ role: "DoctorUser" }).toArray();
            res.json(updatedUsers);

        } catch (err) {
            res.status(400).send({ message: "internal server error" });
        }
    });

    // -----------------------------------------
    // 🟥 Get Admin Users
    // -----------------------------------------
    app.get("/admin/create-user", async (req, res) => {
        const users = await usersCollection.find({ role: "AdminUser" }).toArray();
        res.send(users);
    });

    // -----------------------------------------
    // 🟥 Get assistant Users
    // -----------------------------------------
    app.get("/assistant/create-user", async (req, res) => {
        const doctorEmail = req.query.doctorEmail;
        const users = await usersCollection.find({ role: "AssistantUser", doctorEmail }).toArray();
        res.send(users);
    });


    return app;
};

