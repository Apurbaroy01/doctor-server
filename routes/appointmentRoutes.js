const express = require("express");
const { ObjectId } = require("mongodb");
const { DateTime } = require("luxon");

module.exports = function (appointmentCollection) {
    const app = express.Router();


    function timeToMinutes(t) {
        // Expect: "h:mm AM" / "hh:mm PM"
        const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec((t || "").trim());
        if (!m) return null;
        let h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        const mer = m[3].toUpperCase();
        if (h === 12) h = 0;             // 12 AM -> 0
        let mins = h * 60 + mm;
        if (mer === "PM") mins += 12 * 60; // add 12h for PM
        return mins;
    };

    app.get("/appointments", async (req, res) => {
        try {
            let { date, q, payment } = req.query;

            // date না এলে আজকের তারিখ
            if (!date) {
                date = DateTime.now().setZone("Asia/Dhaka").toFormat("yyyy-MM-dd");
            }

            const query = { date };

            if (q) {
                const rx = { $regex: q, $options: "i" };
                query.$or = [
                    { name: rx },
                    { trackingId: rx },
                    { mobile: rx },
                    { address: rx },
                    { payment: rx },
                ];
            }

            if (payment) {
                query.payment = { $regex: `^${payment}$`, $options: "i" }; // exact-ish match, case-insensitive
            }

            const docs = await appointmentCollection
                .find(query)
                .sort({ date: 1, timeMinutes: 1, time: 1 })
                .toArray();

            res.send(docs);
        } catch (err) {
            console.error("GET /appointments error:", err);
            res.status(500).send({ message: "Failed to fetch appointments" });
        }
    });


    app.post("/appointments", async (req, res) => {
        try {
            const body = req.body || {};

            const timeMinutes = timeToMinutes(body.time);
            if (timeMinutes == null) {
                return res.status(400).send({ message: "Invalid time format. Use like '10:20 AM'." });
            }

            const clash = await appointmentCollection.findOne({ date: body.date, time: body.time });
            if (clash) {
                return res.status(409).send({ message: "This time slot is already booked for the selected date." });
            }

            const doc = { ...body, timeMinutes };
            const result = await appointmentCollection.insertOne(doc);
            res.send(result);
        } catch (err) {
            console.error("POST /appointments error:", err);
            if (err?.code === 11000) {
                return res.status(409).send({ message: "Duplicate entry (trackingId or date+time)" });
            }
            res.status(500).send({ message: "Failed to create appointment" });
        }
    });


    app.delete("/appointments/:id", async (req, res) => {
        try {
            const result = await appointmentCollection.deleteOne({ _id: new ObjectId(req.params.id) });
            res.send(result);
        } catch (err) {
            console.error("DELETE /appointments/:id error:", err);
            res.status(500).send({ message: "Failed to delete appointment" });
        }
    });


    app.get("/appointmentsList", async (req, res) => {
        const result = await appointmentCollection.find().toArray();
        res.send(result);
    });





    return app;
};
