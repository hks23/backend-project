

const asyncHandler = (requestHandler)=> {
    (req,res,next) =>{
        Promise.resolve(requestHandler(req, res, next)).catch((err)=> next(err))
    }
}

 




/*THE BELOW CODE USE TRY AND CATCH STATEMENTS 

const asyncHandler = (fn)=> { async (req,res,next) => { //this line is same as 
    try{
        await fn(req, res , next)
    } catch(error){
        res.status(err.code || 500).json({
            success: false,
            message: err.message
        })
    }
} }  
// const asyncHandler = ()=> {}
// const asyncHandler = (func) => () => {}
// const asyncHandler = (func) => async() =>{}
*/

export {asyncHandler}