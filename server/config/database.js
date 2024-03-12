const mongoose = require("mongoose")
require("dotenv").config();

exports.dbConnect = () =>{
    mongoose.connect(process.env.DATABASE_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true 
    })
    .then(() => {
        console.log("Data base connection Successfully..");
    })
    .catch((err) => {
        console.log("Connection Failed...");
        console.error(err);
        process.exit(1);
    })
}