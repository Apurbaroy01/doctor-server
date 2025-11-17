const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (noticeCollection, headlineCollection) {
    const app = express.Router();

    // GET: All notices
    app.get("/api/notices", async (req, res) => {
        const notices = await noticeCollection
            .find()
            .sort({ date: -1 })
            .toArray();

        res.send(notices);
    });

    // POST: Add notice
    app.post("/api/notices", async (req, res) => {
        try {
            const newNotice = req.body;
            newNotice.date = new Date();

            const result = await noticeCollection.insertOne(newNotice);
            res.status(201).send(result);
        } catch (err) {
            console.error(err);
            res.status(500).send({ message: "Failed to add notice" });
        }
    });


    // DELETE: Remove notice
    app.delete("/api/notices/:id", async (req, res) => {
        const result = await noticeCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        res.send(result);
    });


    // ---------------------------------------------------------


    // GET all headlines
    app.get("/api/headlines", async (req, res) => {
        const data = await headlineCollection.find().toArray();
        res.send(data);
    });

    // POST new headline
    app.post("/api/headlines", async (req, res) => {
        const newHeadline = { text: req.body.text, date: new Date() };
        const result = await headlineCollection.insertOne(newHeadline);
        res.send(result);
    });

    // DELETE headline
    app.delete("/api/headlines/:id", async (req, res) => {
        const { id } = req.params;
        const result = await headlineCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });

    return app;
};
