import { asyncHandler } from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from  "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"

const generateAccessAndRefreshTokens = async(userId)=>{
    try{
        const user = await User.findById(userId)
        const accessToken = user.generateAcessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})
        //validate before save is set false because at this point we dont have password field
        //which is required so it will result in error
        return {accessToken , refreshToken}

    }catch(error){
        throw new apiError(500,"Something went wrong while creating tokens")
    }
}
//LINE 8-78 code for registering the user 
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
    console.log("email: ", fullName); 

    // if(fullName === ""){
    //     throw new apiError(400 , "Full name is required")
    // }
    //instead of using the above if for each field we can write like this 
    if([fullName,email,username,password].some((field)=>field?.trim()==="")) //some method is used
    {
        throw new apiError(400,"All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new apiError (409 , "User with email or username already exists")
    }
    
    //using multer to access files and 
    const avatarLocalPath = req.files?.avatar[0]?.path; //? syntax coz we r not sure if file milegi ya nahi
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is required")
    }
    //await coz video uplaod karne me to time lagega 
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    // console.log(avatar)

    if(!avatar){
        throw new apiError(400 , "Avatar file is required ")
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
//LINE ##-## for logging in the user 
const loginUser = asyncHandler(async(req,res) => {
    //request body se data le aao
    //username email check karo already hai ya nahi
    //find the user
    //password check
    //access and refresh token 
    //send cookie
    const {username , email , password} = req.body
    if(!username || !email){
        throw new apiError(400, "username or email is required")
    }

    const user = await User.findOne({
        $or: [{username} , {email}]   //javascript style of fining either of two in User db
    })

    if(!user){
        throw new apiError(404 , "User does not exists")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new apiError(401 , "Invalid password")
    }
    //since we have checked for user's username and pswd now create access and refresh tokens 
    const {accessToken , refreshToken}= await generateAccessAndRefreshTokens(user._id)

    //send in cookies    
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly: true, //by writing this we make sure that cookies are only
        secure: true   //modifiable by server 
    }
    //cookie-parser install kar liya tha so we can use .cookie
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new apiResponse(200, {user: loggedInUser , accessToken, refreshToken}, "User logged in Successfully"))


})

const logoutUser = asyncHandler(async(req,res)=>{
    /*for logging out first delete his refresh token 
    login karne ke liye hamare paas user ke credentials the lekin logut
    karte time user se we cant ask to fill up his email pswd again so to solve this we use middleware */
    User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {refreshToken: undefined }
        },
        {new:true}
    )
    const options = {
        httpOnly: true, //by writing this we make sure that cookies are only
        secure: true   //modifiable by server 
    }
    return res
        .status(200)
        .clearCookie("accessToken" , options)
        .clearCookie("refreshToken" , options)
        .json(new apiResponse(200,{}, "User logged out"))
})

export {
    registerUser,
    loginUser,
    logoutUser
} 