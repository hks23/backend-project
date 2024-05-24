import { asyncHandler } from "../utils/asyncHandler.js"
import { apiError } from "../utils/apiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from  "../utils/cloudinary.js"
import { apiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"

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
//code for registering the user 
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
//for logging in the user 
const loginUser = asyncHandler(async(req,res) => {
    //request body se data le aao
    //username email check karo already hai ya nahi
    //find the user
    //password check
    //access and refresh token 
    //send cookie
    const {username , email , password} = req.body
    if(!(username || email)){
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
//user ko logout karne ka code
const logoutUser = asyncHandler(async(req,res)=>{
    /*for logging out first delete his refresh token 
    login karne ke liye hamare paas user ke credentials the lekin logut
    karte time user se we cant ask to fill up his email pswd again so to solve this we use middleware */
    User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {refreshToken: 1}
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
//refreshToken updation
const refreshAccessToken = asyncHandler(async(req,res)=>{
    //first access refresh token from cookies - thats why we installed cookie parser
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    if(!incomingRefreshToken){
        throw new apiError(401,"Unauthorised request")
    }
    
    //verify the token from json web token JWT
    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if(!user){
            throw new apiError(401 , "Invallid refresh token")
        }
    
        //match incoming refresh token and orginal refresh token
        if(incomingRefreshToken !== user?.refreshToken){
            throw new apiError(401 , "Refresh token expired")
        }
    
        const options = {
            httpOnly:true,
            secure: true
        }
        const {accessToken , newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
                  .status(200)
                  .cookie("accessToken" , accessToken , options)
                  .cookie("refreshToken" , newRefreshToken , options)
                  .json(
                    new apiResponse(
                        200,
                        {accessToken ,refreshToken: newRefreshToken},
                        "Access token refreshed"
                    )
                  )
    } catch (error) {
        throw new apiError(401, error?.message || "Invalid refresh token" )
        
    }
})
//change password code
const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword , newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const pswdCheck = await user.isPasswordCorrect(oldPassword)
    if(!pswdCheck){
        throw new apiError(400 , "Invalid Old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
            .status(200)
            .json(new apiResponse(200, {}, "Password Changed successfully"))
})
//get Current user
const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
            .status(200)
            .json(new apiResponse(200,req.user,"User fetched successfully"))
})
//Update account details like name email
const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName , email} = req.body

    if(!fullName || !email){
        throw new apiError(400, "All fields are required")
    }

    User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullName: fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res
            .status(200)
            .json(new apiResponse(200 , user, "Account details updated successfully"))
})
 //update avatar file
 const updateUserAvatar = asyncHandler(async(req,res)=>{

    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new apiError(400, "Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)

    if(!avatar.url){
        throw new apiError(400 , "Error while uplaoding Avatar image")
    }
    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password") //i.e update everything except password 

    return res
            .status(200)
            .json(new apiResponse(200 , user , "Avatar Image Uploaded successfully"))


})

const updateUserCoverImage = asyncHandler(async(req,res)=>{

    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new apiError(400, "Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url){
        throw new apiError(400 , "Error while uplaoding cover image")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password") //i.e update everything except password 

    return res
            .status(200)
            .json(new apiResponse(200 , user , "Cover Image Uploaded successfully"))
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params

    if(!username?.trim()){
        throw new apiError(400, "Username is missing")
    }
    
    const channel = await User.aggregate([
        //aggregate returns array of Objects
        {
            $match:{
                username: username.toLowerCase()   
            }
        },
        {
            $lookup:{ //very IMP code look for AGGREGATION PIPELINE ON MONGODB DOCS
                from: "Subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup:{ //very IMP code look for AGGREGATION PIPELINE ON MONGODB DOCS
                from: "Subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount: {
                    $size: "$subscribers"    //dollar sign used because subscriber is a field
                },
                channelsSubscribedToCount:{
                    $size: "$subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if: {$in: [req.user?._id , "$subscribers.subscriber"]}, 
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName:1,
                username:1,
                subscribersCount:1,
                channelsSubscribedToCount:1,
                isSubscribed:1,
                avatar: 1,
                coverImage: 1,
                email: 1 
            }
        }        
    ])
    if(!channel?.length){
        throw new apiError(404 , "Channel does not exists")
    }

    return res
            .status(200)
            .json(new apiResponse(200, channel[0], "User Channel fetched successfully"))  
})

const getWatchHistory = asyncHandler(async(req,res) =>{
    const user = await User.aggregate([
        {
            $match:{
                _id: new mongoose.Types.ObjectId(req.user._id) //we cant simply write only req.user._id because that returns a string not complete ID 
            }
        },
        {
            $lookup:{
                from: "Videos",
                localField: "watchHistory", //local field refers to schema we r currently in
                foreignField: "_id", //foreign field refers to schema jisse match karake data lana hai
                as: "watchHistory", 
                //subpipeline
                pipeline:[
                    {
                        $lookup:{
                            from: "Users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            //subpipeline
                            pipeline:[
                                {
                                    $project:{
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                 }
                            ]                                                             
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(
        new apiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )
})



export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
} 