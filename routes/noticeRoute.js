const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (noticeCollection) {
    const app = express.Router();

    // GET: All notices
    app.get("/api/notices", async (req, res) => {
        const notices = await noticeCollection
            .find()
            .sort({ date: -1 })
            .toArray();

        res.json(notices);
    });

    // POST: Add notice
    app.post("/api/notices", async (req, res) => {
        const newNotice = {
            message: req.body.message,
            date: new Date()
        };

        const result = await noticeCollection.insertOne(newNotice);
        res.json(result);
    });

    // DELETE: Remove notice
    app.delete("/api/notices/:id", async (req, res) => {
        const result = await noticeCollection.deleteOne({
            _id: new ObjectId(req.params.id)
        });

        res.json(result);
    });

    return app;
};
