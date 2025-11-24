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

    // ✅ GET: Fetch all appointments (filter by email/date/search/payment)
    app.get("/appointments", async (req, res) => {
        try {
            let { email, date, q, payment } = req.query;

            if (!email) {
                return res.status(400).send({ message: "Email is required" });
            }

            // Default date = today
            if (!date) {
                date = DateTime.now()
                    .setZone("Asia/Dhaka")
                    .toFormat("yyyy-MM-dd");
            }

            const query = { doctorEmail: email };
            if (date) query.date = date;

            // 🔍 optional search
            if (q && q.trim()) {
                const rx = { $regex: q.trim(), $options: "i" };
                query.$or = [
                    { name: rx },
                    { trackingId: rx },
                    { mobile: rx },
                    { address: rx },
                    { payment: rx },
                ];
            }

            // 🔍 optional payment filter
            if (payment && payment.trim()) {
                query.payment = { $regex: `^${payment}$`, $options: "i" };
            }

            const docs = await appointmentCollection
                .find(query)
                .sort({ date: 1, timeMinutes: 1, time: 1 })
                .toArray();

            res.status(200).send(docs);
        } catch (err) {
            console.error("❌ GET /appointments error:", err);
            res.status(500).send({ message: "Failed to fetch appointments" });
        }
    });


    // ✅ GET: Fetch Assistant all appointments (filter by email/date/search/payment)
    app.get("/assistantAppointments", async (req, res) => {
        try {
            let { email, date, q, payment } = req.query;

            if (!email) {
                return res.status(400).send({ message: "Email is required" });
            }

            // Default date = today
            if (!date) {
                date = DateTime.now()
                    .setZone("Asia/Dhaka")
                    .toFormat("yyyy-MM-dd");
            }

            const query = { assistantEmail: email };
            if (date) query.date = date;

            // 🔍 optional search
            if (q && q.trim()) {
                const rx = { $regex: q.trim(), $options: "i" };
                query.$or = [
                    { name: rx },
                    { trackingId: rx },
                    { mobile: rx },
                    { address: rx },
                    { payment: rx },
                ];
            }

            // 🔍 optional payment filter
            if (payment && payment.trim()) {
                query.payment = { $regex: `^${payment}$`, $options: "i" };
            }

            const docs = await appointmentCollection
                .find(query)
                .sort({ date: 1, timeMinutes: 1, time: 1 })
                .toArray();

            res.status(200).send(docs);
        } catch (err) {
            console.error("❌ GET /appointments error:", err);
            res.status(500).send({ message: "Failed to fetch appointments" });
        }
    });


    app.post("/appointments", async (req, res) => {
        try {
            const body = req.body || {};
            console.log("📩 Incoming appointment:", body);

            // ✅ Validate time format
            const timeMinutes = timeToMinutes(body.time);
            if (timeMinutes == null) {
                return res
                    .status(400)
                    .send({ message: "Invalid time format. Use like '10:20 AM'." });
            }

            // ✅ Check time clash for same date/time for same doctor
            const clash = await appointmentCollection.findOne({
                date: body.date,
                time: body.time,
                doctorEmail: body.doctorEmail,
            });
            if (clash) {
                return res
                    .status(409)
                    .send({ message: "This time slot is already booked for the selected date." });
            }

            // ✅ Check if mobile already exists (same patient)
            let trackingId;
            const existingAppointment = await appointmentCollection.findOne({
                mobile: body.mobile,
                doctorEmail: body.doctorEmail,
            });

            if (existingAppointment) {
                trackingId = existingAppointment.trackingId; // reuse old ID
            } else {
                trackingId = `TRK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
            }

            // ✅ Prepare final document
            const doc = {
                ...body,
                timeMinutes,
                trackingId,
                status: "Pending",
                createdAt: new Date(),
            };

            const result = await appointmentCollection.insertOne(doc);
            res.send({ success: true, trackingId, insertedId: result.insertedId });
        } catch (err) {
            console.error("❌ POST /appointments error:", err);
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


    app.get("/appointmentsList/:email", async (req, res) => {
        const doctorEmail = req.params.email;
        console.log(doctorEmail);
        const result = await appointmentCollection.find({ doctorEmail }).toArray();
        res.send(result);
    });


    // // PATCH /appointments/:id
    // app.patch("/appointments/:id", async (req, res) => {
    //     const { id } = req.params;
    //     const { status, prescription } = req.body; // prescription destructure করো

    //     const query = { _id: new ObjectId(id) };
    //     const updateDoc = {
    //         $set: {},
    //     };

    //     if (status) updateDoc.$set.status = status;
    //     if (prescription) updateDoc.$set.prescription = prescription;

    //     const result = await appointmentCollection.updateOne(query, updateDoc);
    //     res.send(result);
    // });


    // PATCH /appointments/:id
app.patch("/appointments/:id", async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const query = { _id: new ObjectId(id) };

    const updateDoc = {
        $set: updateData,  // body তে যা থাকবে সব আপডেট হবে
    };

    const result = await appointmentCollection.updateOne(query, updateDoc);
    res.send(result);
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



    // 🔹 সার্চ রাউট (doctorEmail অনুযায়ী ফিল্টার সহ)
    app.get("/patients/search", async (req, res) => {
        const query = req.query.q;
        const doctorEmail = req.query.email;

        if (!query || !doctorEmail) {
            return res.json([]); 
        }

        try {
           
            const patients = await appointmentCollection
                .find({
                    doctorEmail, // শুধু ঐ ডাক্তারের রেকর্ড
                    $or: [
                        { mobile: { $regex: query, $options: "i" } },
                        { patientId: { $regex: query, $options: "i" } },
                        { name: { $regex: query, $options: "i" } },
                    ],
                })
                .limit(1)
                .toArray();

            res.json(patients);
        } catch (err) {
            console.error("❌ Error in /patients/search:", err);
            res.status(500).json({ error: err.message });
        }
    });

    // ✅ Get all payments
    app.get("/payments", async (req, res) => {
        const doctorEmail = req.query.email;
        if (doctorEmail) {
            const drugs = await appointmentCollection.find({ doctorEmail: doctorEmail }).sort({ name: 1 }).toArray();
            return res.send(drugs);
        }
        
    });



    return app;
};
