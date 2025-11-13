const express = require("express");
const { app } = require("firebase-admin");
const { ObjectId } = require("mongodb");

module.exports = function (testCollection) {
    const app = express.Router();

    // 🔹 GET /tests?email=doctor@example.com
    app.get("/tests", async (req, res) => {
        const { email } = req.query;
        try {
            const tests = await testCollection
                .find({ doctorEmail: email })
                .sort({ createdAt: -1 })
                .toArray();
            res.json(tests);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to fetch tests" });
        }
    });

    // 🔹 GET /tests/search?q=Blood&email=doctor@example.com
    app.get("/tests/search", async (req, res) => {
        const { q, email } = req.query;
        try {
            const regex = new RegExp(q, "i");
            const tests = await testCollection
                .find({ doctorEmail: email, name: regex })
                .toArray();
            res.json(tests);
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Search failed" });
        }
    });

    // 🔹 POST /tests
    app.post("/tests", async (req, res) => {
        const newTest = req.body;
        try {
            const result = await testCollection.insertOne(newTest);
            res.json({ ...newTest, _id: result.insertedId });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to add test" });
        }
    });

    // 🔹 PATCH /tests/:id
    app.patch("/tests/:id", async (req, res) => {
        const { id } = req.params;
        const updated = req.body;
        try {
            await testCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updated }
            );
            res.json({ _id: id, ...updated });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to update test" });
        }
    });

    // 🔹 DELETE /tests/:id
    app.delete("/tests/:id", async (req, res) => {
        const { id } = req.params;
        try {
            await testCollection.deleteOne({ _id: new ObjectId(id) });
            res.json({ message: "Test deleted successfully" });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Failed to delete test" });
        }
    });

    return app;
};
