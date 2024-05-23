// require('dotenv').config({path: './env'})
import dotenv from "dotenv"
import connectDB from "./db/index.js";
import {app} from './app.js'

dotenv.config({    //config environment variables 
    path: './.env'
})

connectDB() //establish connection with db

.then(()=>{
    app.listen(process.env.PORT || 3000 , ()=>{ //listen to the server 
        console.log(`server is running at port : ${(process.env.PORT)}`);
    })
})
.catch((err)=>{
    console.log("MONGO db connection failed !!!" , err);
})


/* BELOW IS ONE APPROACH TO CONNECT DATABASE WITH MONGOOSE IT USES TRY CATCH -- AYSNC AWAIT APPROACH
import express from "express"
const app = express()

( async () => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${ DB_NAME }`)
        app.on("error", ()=>{
            console.log("ERRR:" , error);
            throw error
        })

        app.listen(process.env.PORT, ()=> {
            console.log(`App is listening on Port ${process.env.PORT}`);
        })
    
    } catch(error){
        console.error("ERROR: ", error)
        throw err
    }
}) ()
*/
