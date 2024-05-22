import { asyncHandler } from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from  "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"


const registerUser = asyncHandler( async(req,res) =>{
    //get user details from frontend 
    //validation - not empty
    //check if user already exists : username , email
    //check for images, check for avatar
    //upload them to cloudinary, avatar
    //create user object - create entry in db
    //remove password and refresh token field from response
    //check for user creation
    //return 
    
    const{fullName, email, username, password} = req.body
    console.log("email: ", email); 

    if(fullName === ""){
        throw new apiError(400 , "Full name is required")
    }
    //instead of using the above if for each field we can write like this 
    if([fullName,email,username,password].some((field)=>field?.trim()==="")) //some method is used
    {
        throw new apiError(400,"All fields are required")
    }

    const existedUser = User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new apiError(409 , "User with email or username already exists")
    }
    
    //using multer to access files and 
    const avatarLocalPath = req.files?.avatar[0]?.path; //? syntax coz we r not sure if file milegi ya nahi
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is required")
    }
    //await coz video uplaod karne me to time lagega 
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new apiError(400 , "Avatar file is required")
    }

    const user = await User.create(
        {
            fullName,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        }
    )
    //- sign denotes which fields not to select
    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    
    if(!createdUser){
        throw new apiError(500 , "Something went wrong")
    }

    return res.status(201).json(
        new apiResponse(200, createdUser ,"User registered Successfully")
    )


})

export {registerUser} 