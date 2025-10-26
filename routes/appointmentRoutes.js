const express = require("express");
const { ObjectId } = require("mongodb");

module.exports = function (appointmentCollection) {

    const app = express.Router();


    app.get("/appointments", async (req, res) => {
        const result = await appointmentCollection.find().toArray();
        res.send(result);
    });


    app.post("/appointments", async (req, res) => {
        const newAppointment = req.body;
        const result = await appointmentCollection.insertOne(newAppointment);
        res.send(result);
    });


    app.delete("/appointments/:id", async (req, res) => {
        const id = req.params.id;
        const result = await appointmentCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
    });


    app.get("/appointments", async (req, res) => {
        const { date } = req.query;
        const query = date ? { date } : {};
        const result = await appointmentCollection.find(query).toArray();
        res.send(result);
    });


    return app;
};
