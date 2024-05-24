import mongoose , {Schema} from "mongoose";
const subscriptionSchema = new Schema({

    subscriber:{
        //basically all users from user schema who r subscribing
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    channel:{
        type:Schema.Types.ObjectId,
        ref: "User" //kyuki channel bhi to kisi user ka hi hoga
    }
},{timestamps:true})

export const Subscription = mongoose.model("Subscription", subscriptionSchema)