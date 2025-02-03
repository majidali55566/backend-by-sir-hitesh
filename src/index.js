import "dotenv/config";
import express from "express";
import connectDB from "./DB/connect.js";
import app from "./app.js";


connectDB().then((
)=>{
    app.listen(process.env.PORT || 8000,()=>{
        console.log(`Server is running on ${process.env.PORT}`
        )
    });
}).catch((error)=>{
    console.log("MONGODB CONNECTION ERROR :: " + error)
});
