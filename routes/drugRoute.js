// server/drugRoute.js
const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (drugCollection) {
    const app = express.Router();

    // ✅ Add new drug
    app.post("/drugs/", async (req, res) => {
        const drug = req.body;
        const result = await drugCollection.insertOne(drug);
        res.send(result);
    });

    // ✅ Get all drugs
    app.get("/drugs/", async (req, res) => {
        const drugs = await drugCollection.find().sort({ name: 1 }).toArray();
        res.send(drugs);
    });

    // ✅ Search drugs by name
    app.get("/api/drugs/search", async (req, res) => {
        const q = req.query.q || "";
        const drugs = await drugCollection
            .find({ name: { $regex: q, $options: "i" } })
            .limit(10)
            .toArray();
        res.send(drugs);
    });

    // ✅ Update drug
    app.patch("/drugs/:id", async (req, res) => {
        const { id } = req.params;
        const data = req.body;
        const result = await drugCollection.updateOne(
            { _id: new ObjectId(id) },
            { $set: data }
        );
        res.send(result);
    });

    // ✅ Delete drug
    app.delete("/drugs/:id", async (req, res) => {
        const { id } = req.params;
        const result = await drugCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });

    return app;
};
