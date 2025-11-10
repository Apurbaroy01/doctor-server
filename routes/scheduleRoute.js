// routes/scheduleRoute.js
const express = require("express");

module.exports = function (scheduleCollection) {
    const app = express.Router();

    // 🔹 Create or Update Schedule (Upsert)
    app.put("/schedule/update", async (req, res) => {
        try {
            const data = req.body;
            if (!data.email)
                return res.status(400).send({ success: false, message: "Email required" });

            const query = { email: data.email };
            const updateDoc = {
                $set: {
                    title: data.title,
                    address: data.address,
                    contactPerson: data.contactPerson,
                    phone: data.phone,
                    email: data.email,
                    days: data.days || [],
                    updatedAt: new Date(),
                },
            };

            const result = await scheduleCollection.updateOne(query, updateDoc, {
                upsert: true,
            });

            res.send({ success: true, result });
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
