// routes/scheduleRoute.js
const express = require("express");

module.exports = function (scheduleCollection, usersCollection) {
    const app = express.Router();


    app.put("/schedule/update", async (req, res) => {
        try {
            const data = req.body;
            const { email, title, address, contactPerson, phone, doctorEmail, days, doctorFee } = data;

            if (!email) {
                return res
                    .status(400)
                    .send({ success: false, message: "Email required" });
            }

            // 1️⃣ Fetch doctor info from userCollection
            const doctorInfo = await usersCollection.findOne({ email: doctorEmail });

            // 2️⃣ Prepare update document
            const updateDoc = {
                $set: {
                    title,
                    address,
                    contactPerson,
                    phone,
                    doctorFee,
                    doctorEmail: doctorEmail || "",
                    email,
                    days: days || [],
                    updatedAt: new Date(),
                    // Merge doctor info into schedule
                    doctorName: doctorInfo?.name || "",
                    doctorPhoto: doctorInfo?.photo || "",
                    doctorProfession: doctorInfo?.profession || "",
                    doctorPhone: doctorInfo?.phone || "",
                },
            };

            // 3️⃣ Update scheduleCollection
            const result = await scheduleCollection.updateOne(
                { email },
                updateDoc,
                { upsert: true }
            );

            // 4️⃣ Return combined response
            res.send({
                success: true,
                scheduleResult: result,
                doctorInfo: doctorInfo || null,
            });
        } catch (error) {
            console.error("Error updating schedule:", error);
            res.status(500).send({ success: false, message: "Server error" });
        }
    });



    // 🔹 Get Schedule by Email
    app.get("/schedule/:email", async (req, res) => {
        try {
            const result = await scheduleCollection.findOne({ email: req.params.email });
            if (!result)
                return res.status(404).send({ success: false, message: "Not found" });
            res.send({ success: true, data: result });
        } catch (error) {
            console.error(error);
            res.status(500).send({ success: false, message: "Server error" });
        }
    });


    // 🔹admin doctor Get Schedule by Email
    app.get("/schedules/:email", async (req, res) => {
        const email = req.params.email;
        try {
            const result = await scheduleCollection.find({ doctorEmail: email }).toArray();
            if (!result)
                return res.status(404).send({ success: false, message: "Not found" });
            res.send(result);

        } catch (error) {
            console.error(error);
            res.status(500).send({ success: false, message: "Server error" });
        }
    });

    // 🔹 Get All Schedules
    app.get("/schedule", async (req, res) => {
        try {
            const result = await scheduleCollection.find().toArray();
            res.send({ success: true, data: result });
        } catch (error) {
            console.error(error);
            res.status(500).send({ success: false, message: "Server error" });
        }
    });

    // 🔹 Get one Schedules hospital data by print
    app.get("/hospital", async (req, res) => {
        const email = req.query.email;
        
        try {
            const result = await scheduleCollection.findOne({ email });
            if (!result)
                return res.status(404).send({ success: false, message: "Not found" });

            res.send({ success: true, data: result });

        } catch (error) {
            console.error(error);
            res.status(500).send({ success: false, message: "Server error" });
        }
    });

    // 🔹 Delete Schedule
    app.delete("/schedule/:email", async (req, res) => {
        try {
            const result = await scheduleCollection.deleteOne({ email: req.params.email });
            res.send({ success: true, result });
        } catch (error) {
            console.error(error);
            res.status(500).send({ success: false, message: "Server error" });
        }
    });

    return app;
};
