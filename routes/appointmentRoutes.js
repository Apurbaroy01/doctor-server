const express = require("express");
const { ObjectId } = require("mongodb");
const { DateTime } = require("luxon");
const crypto = require("crypto");

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
            console.log(body)

            // validate time format
            const timeMinutes = timeToMinutes(body.time);
            if (timeMinutes == null) {
                return res
                    .status(400)
                    .send({ message: "Invalid time format. Use like '10:20 AM'." });
            }

            // check time clash for same date/time
            const clash = await appointmentCollection.findOne({
                date: body.date,
                time: body.time,
            });
            if (clash) {
                return res
                    .status(409)
                    .send({ message: "This time slot is already booked for the selected date." });
            }

            // check if phone already exists
            let trackingId;
            const existingAppointment = await appointmentCollection.findOne({
                phone: body.phone,
            });

            if (existingAppointment) {
                // reuse same trackingId
                trackingId = existingAppointment.trackingId;
            } else {
                // create a new unique trackingId
                trackingId = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
            }

            const doc = {
                ...body,
                timeMinutes,
                trackingId,
                createdAt: new Date(),
            };

            const result = await appointmentCollection.insertOne(doc);
            res.send({ success: true, trackingId, insertedId: result.insertedId });
        } catch (err) {
            console.error("POST /appointments error:", err);
            if (err?.code === 11000) {
                return res
                    .status(409)
                    .send({ message: "Duplicate entry (trackingId or date+time)" });
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


    // PATCH /appointments/:id
    app.patch("/appointments/:id", async (req, res) => {
        const { id } = req.params;
        const { status } = req.body;

        const query = { _id: new ObjectId(id) }
        const updateDoc = {
            $set: { status },
        };
        const result = await appointmentCollection.updateOne(query, updateDoc)
        res.send(result)
    });


    app.get("/appointments/:id", async (req, res) => {
        const id = req.params.id;
        const result = await appointmentCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
    });

    app.get("/patient", async (req, res) => {
        try {
            const { trackingId } = req.query;

            if (!trackingId) {
                return res.status(400).send({ message: "trackingId is required" });
            }

            const result = await appointmentCollection
                .find({ trackingId })
                .sort({ createdAt: -1 })
                .toArray();

            res.send(result);
        } catch (error) {
            console.error("Error fetching appointments:", error);
            res.status(500).send({ message: "Server error" });
        }
    });



    // 🔹 সার্চ রাউট
    app.get("/patients/search", async (req, res) => {
        const query = req.query.q;
        if (!query) return res.json([]);

        try {
            // আংশিক মিল খোঁজা (mobile বা patientId বা name)
            const patients = await appointmentCollection
                .find({
                    $or: [
                        { mobile: { $regex: query, $options: "i" } },
                        { patientId: { $regex: query, $options: "i" } },
                        { name: { $regex: query, $options: "i" } },
                    ],
                })
                .limit(10)
                .toArray();

            res.json(patients);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    });




    return app;
};
