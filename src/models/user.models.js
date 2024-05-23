import mongoose , {Schema} from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"


const userSchema = new Schema({
    username:{
        type: String,
        required: true,
        unique : true,
        lowercase: true,
        trim: true,
        index: true
    },
    email:{
        type: String,
        required: true,
        unique : true,
        lowercase: true,
        trim: true,
    },
    fullName:{
        type: String,
        required: true,
        trim: true,
        index: true 
    },
    avatar:{
        type: String, //cloudinary url service
        required: true
    },
    coverImage:{
        type: String, //cloudinary url service
    },
    watchHistory:[
        {
            type: Schema.Types.ObjectId,
            ref : "Video"
        }
    ],
    password:{
        type: String,
        required: [true , 'Password is required']
    },
    refreshToken:{
        type: String
    }

}, {timestamps: true})

//save event is used on UserSchema and we want to encrypt only one field from the schema so we cant use 
//call back function in pre() coz then we cant use this method
userSchema.pre("save" , async function(next){ //async coz encryption takes time
    if( !this.isModified("password")){
        return next();
    }
    this.password = await bcrypt.hash(this.password , 10) //password encryption
    next() 
})

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password , this.password)

}

userSchema.methods.generateAcessToken = function(){
    return jwt.sign(
        {
            _id : this._id,
            email: this.email,
            username: this.username,
            fullName : this.fullName          
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign(
        {
            _id : this._id,
            email: this.email,
            username: this.username,
            fullName : this.fullName          
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}


export const User = mongoose.model("User" , userSchema);
